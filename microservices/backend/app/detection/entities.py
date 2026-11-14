"""Reads payment details out of text: UTR, UPI id, phone number, amount, date/time, link.

Each kind is cut out of the text once found, so a later pattern cannot read the same digits
again (for example a phone number inside a UTR). Run this on text that `redact_pii` has cleaned.
"""

import re

from app.models import Entity, EntityType

MAX_PER_TYPE = 5
# The most an entity may hold (the API refuses longer). A longer link keeps its start, which is
# where the host name is; any other value this long is not a real detail and is left out.
MAX_VALUE_LENGTH = 500
_ORDER: tuple[EntityType, ...] = ("utr", "upi", "phone", "amount", "datetime", "link")

_LINK = re.compile(r"(?:https?://|www\.)[^\s<>\"']+", re.IGNORECASE)
_LINK_TRAILING = ".,;:!?)]}'\""
# An address written without "http" ("sbi-kyc.xyz/login"). Only well-known endings count, so that
# "e.g." or "Mr.Sharma" are not read as links. Text after "@" is an email, which is removed earlier.
_TLDS = (
    "co.in|gov.in|nic.in|org.in|com|in|org|net|xyz|top|info|online|site|live|click|link|shop|vip"
    "|club|icu|cc|me|app|buzz|store|help"
).replace(".", r"\.")
_BARE_LINK = re.compile(
    rf"(?<![\w@./-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:{_TLDS})\b(?![\w@-])(?:/[^\s<>\"']*)?",
    re.IGNORECASE,
)
# Numbers that look like a phone number but are labelled as something else.
_OTHER_ID = re.compile(
    r"\b(?:pnr|awb|order|booking|tracking)\s*(?:no|number|id)?[\s:#.\-]*\d{8,}", re.IGNORECASE
)

# name@handle, but not an email address (the handle of an email is followed by ".com" and so on).
_UPI = re.compile(r"(?<![\w.@-])[\w.-]{2,}@[A-Za-z][A-Za-z0-9]+\b(?!\.[A-Za-z])")

# A UTR / reference number that follows a label such as "UTR", "Ref No" or "Transaction ID".
_UTR_LABELLED = re.compile(
    r"(?:utr|rrn|upi\s*ref\w*|ref(?:erence)?\.?\s*(?:no|number|id)?|txn\s*(?:id|no)?"
    r"|transaction\s*(?:id|no|number)?|यूटीआर|संदर्भ\s*(?:संख्या|नंबर)?"
    r"|ट्रांजैक्शन\s*(?:आईडी|नंबर)?)"
    r"[\s:#.\-]*(?:is\s+)?"
    r"(?P<value>(?=(?:[A-Za-z]*\d){9})[A-Za-z0-9]{12,22})(?![A-Za-z0-9])",
    re.IGNORECASE,
)
# A bare 12-digit number. Aadhaar numbers are already removed, so what is left is a UTR.
_UTR_BARE = re.compile(r"(?<!\d)\d{12}(?!\d)")

_PHONE = re.compile(r"(?<!\d)(?:(?:\+91|91|0)[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)")

_AMOUNT = re.compile(
    r"(?:₹|\bRs\.?|\bINR)\s?\d(?:[\d,]*\d)?(?:\.\d{1,2})?"
    r"|\b\d(?:[\d,]*\d)?\s?(?:rupees|rupaye|रुपये|रुपए)",
    re.IGNORECASE,
)

_DATETIME = re.compile(
    r"\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}"
    r"(?:,?\s+(?:at\s+)?\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)?",
    re.IGNORECASE,
)


def _take(pattern: re.Pattern[str], text: str, group: str | int = 0) -> tuple[list[str], str]:
    """Returns every match and the text with those matches blanked out."""
    found: list[str] = []

    def blank(match: re.Match[str]) -> str:
        found.append(" ".join(match.group(group).split()))
        return " " * len(match.group())

    return found, pattern.sub(blank, text)


def extract_entities(text: str) -> list[Entity]:
    links, rest = _take(_LINK, text)
    bare_links, rest = _take(_BARE_LINK, rest)
    upi, rest = _take(_UPI, rest)
    utr, rest = _take(_UTR_LABELLED, rest, "value")
    _, rest = _take(_OTHER_ID, rest)
    amount, rest = _take(_AMOUNT, rest)
    when, rest = _take(_DATETIME, rest)
    phone, rest = _take(_PHONE, rest)
    bare_utr, _ = _take(_UTR_BARE, rest)

    found: dict[EntityType, list[str]] = {
        "utr": utr + bare_utr,
        "upi": upi,
        "phone": phone,
        "amount": amount,
        "datetime": when,
        "link": [link.rstrip(_LINK_TRAILING) for link in links + bare_links],
    }
    return [
        Entity(type=kind, value=value[:MAX_VALUE_LENGTH])
        for kind in _ORDER
        for value in list(dict.fromkeys(found[kind]))[:MAX_PER_TYPE]
        if len(value) <= MAX_VALUE_LENGTH or kind == "link"
    ]
