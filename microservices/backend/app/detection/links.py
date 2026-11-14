"""Checks a web address for the tricks used in fake bank and agency links.

A link is `official` only when its host is exactly an official domain (or a subdomain of one),
compared in ASCII (punycode) form so that a look-alike spelling can never match.
Everything else is "unknown": we do not call it safe, and it is flagged only when it imitates
a known name.
"""

import re
import unicodedata
from dataclasses import dataclass
from typing import Final
from urllib.parse import urlsplit

from app.models import ReasonCode

MAX_URL_LENGTH = 2048

# Domains we are sure about (verify before adding more). `.gov.in` and `.nic.in` can only be
# registered by government bodies.
OFFICIAL_DOMAINS: Final = (
    "onlinesbi.sbi",
    "sbi.co.in",
    "hdfcbank.com",
    "icicibank.com",
    "axisbank.com",
    "kotak.com",
    "paytm.com",
    "phonepe.com",
    "npci.org.in",
    "rbi.org.in",
    "epfindia.gov.in",
    "irctc.co.in",
)
OFFICIAL_SUFFIXES: Final = (".gov.in", ".nic.in")

# Names that scam links imitate, and words scammers attach to them ("sbi-kyc", "paytmrefund").
BRANDS: Final = (
    "sbi",
    "hdfc",
    "icici",
    "axis",
    "kotak",
    "paytm",
    "phonepe",
    "npci",
    "rbi",
    "cbi",
    "uidai",
    "epfo",
    "irctc",
    "incometax",
)
SCAM_WORDS: Final = (
    "kyc",
    "update",
    "verify",
    "verification",
    "login",
    "secure",
    "support",
    "care",
    "bank",
    "pay",
    "refund",
    "reward",
    "rewards",
    "offer",
    "account",
    "helpdesk",
    "customer",
    "netbanking",
    "online",
    "alert",
    "claim",
    "card",
    "redeem",
)

# Cyrillic and Greek letters that look like Latin ones.
_CONFUSABLES: Final = {
    ord(lookalike): latin
    for lookalike, latin in {
        "а": "a",
        "е": "e",
        "о": "o",
        "р": "p",
        "с": "c",
        "х": "x",
        "у": "y",
        "і": "i",
        "ѕ": "s",
        "ԁ": "d",
        "ӏ": "l",
        "ο": "o",
        "α": "a",
        "ν": "v",
        "ρ": "p",
    }.items()
}
# Digits used in place of letters ("sb1", "ph0nepe").
_LEET: Final = str.maketrans("0135", "oies")


@dataclass(frozen=True)
class LinkCheck:
    reasons: list[ReasonCode]
    official: bool


def normalize_url(raw: str) -> str | None:
    """The address with a scheme, or None when it is not a web address."""
    raw = raw.strip()
    if not raw or len(raw) > MAX_URL_LENGTH or re.search(r"\s", raw):
        return None
    url = raw if re.match(r"[a-z][a-z0-9+.-]*://", raw, re.IGNORECASE) else f"https://{raw}"
    try:
        parts = urlsplit(url)
        host = parts.hostname
        _ = parts.port
    except ValueError:
        return None
    if parts.scheme.lower() not in ("http", "https") or not host or "." not in host:
        return None
    return url


def _hosts(hostname: str) -> tuple[str, str]:
    """The host in Unicode form and in ASCII (punycode) form."""
    hostname = hostname.rstrip(".").lower()
    try:
        shown = hostname.encode("ascii").decode("idna") if "xn--" in hostname else hostname
        return shown, shown.encode("idna").decode("ascii")
    except UnicodeError:
        return hostname, hostname


def _is_official(ascii_host: str) -> bool:
    return ascii_host.endswith(OFFICIAL_SUFFIXES) or any(
        ascii_host == domain or ascii_host.endswith(f".{domain}") for domain in OFFICIAL_DOMAINS
    )


def _mixed_script(label: str) -> bool:
    scripts = {unicodedata.name(char, "").split(" ")[0] for char in label if char.isalpha()}
    return len(scripts) > 1


def _one_edit_apart(a: str, b: str) -> bool:
    if a == b or abs(len(a) - len(b)) > 1:
        return False
    i = 0
    while i < min(len(a), len(b)) and a[i] == b[i]:
        i += 1
    if len(a) == len(b):
        return a[i + 1 :] == b[i + 1 :]
    short, long = sorted((a, b), key=len)
    return short[i:] == long[i + 1 :]


def _brand_like(word: str) -> bool:
    for brand in BRANDS:
        if word == brand or any(word in (brand + extra, extra + brand) for extra in SCAM_WORDS):
            return True
        # A one-letter typo of a longer name ("paytn", "phonepee").
        if len(brand) >= 5 and _one_edit_apart(word, brand):
            return True
    return False


def _imitates_brand(shown_host: str) -> bool:
    if any(_mixed_script(label) for label in shown_host.split(".")):
        return True
    skeleton = unicodedata.normalize("NFKC", shown_host).translate(_CONFUSABLES)
    for token in re.split(r"[-_.]", skeleton):
        for spelling in {token, token.translate(_LEET)}:
            if _brand_like(spelling.rstrip("0123456789").replace("rn", "m")):
                return True
    return False


def check_link(url: str) -> LinkCheck:
    parts = urlsplit(url)
    shown, ascii_host = _hosts(parts.hostname or "")
    official = _is_official(ascii_host)

    reasons: list[ReasonCode] = []
    # "https://sbi.co.in@evil.example": everything before the "@" is only a decoy.
    decoy = "." in (parts.username or "")
    if not official and (decoy or _imitates_brand(shown)):
        reasons.append("lookalike_domain")
    if parts.scheme.lower() == "http":
        reasons.append("insecure_link")
    return LinkCheck(reasons=reasons, official=official)
