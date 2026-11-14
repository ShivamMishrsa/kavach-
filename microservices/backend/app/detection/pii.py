"""Removes Aadhaar and PAN numbers and email addresses from text before anything else looks at it.

The old bug this guards against: a 12-digit Aadhaar pattern also matches a UPI reference (UTR),
so a naive redactor erases the very number a victim needs to report. Here a 12-digit number is
treated as Aadhaar only when it is not labelled as a payment reference AND either it is labelled
as Aadhaar or it passes the Verhoeff check that every real Aadhaar number passes. A number that
fails the check cannot be an Aadhaar number, so it is left alone and later read as a UTR.
"""

import re

_D = (
    (0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
    (1, 2, 3, 4, 0, 6, 7, 8, 9, 5),
    (2, 3, 4, 0, 1, 7, 8, 9, 5, 6),
    (3, 4, 0, 1, 2, 8, 9, 5, 6, 7),
    (4, 0, 1, 2, 3, 9, 5, 6, 7, 8),
    (5, 9, 8, 7, 6, 0, 4, 3, 2, 1),
    (6, 5, 9, 8, 7, 1, 0, 4, 3, 2),
    (7, 6, 5, 9, 8, 2, 1, 0, 4, 3),
    (8, 7, 6, 5, 9, 3, 2, 1, 0, 4),
    (9, 8, 7, 6, 5, 4, 3, 2, 1, 0),
)
_P = (
    (0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
    (1, 5, 7, 6, 2, 8, 3, 0, 9, 4),
    (5, 8, 0, 3, 7, 9, 6, 1, 4, 2),
    (8, 9, 1, 6, 0, 4, 3, 5, 2, 7),
    (9, 4, 5, 3, 1, 2, 6, 8, 7, 0),
    (4, 2, 8, 6, 5, 7, 3, 9, 0, 1),
    (2, 7, 9, 3, 8, 0, 6, 4, 1, 5),
    (7, 0, 4, 6, 9, 1, 3, 2, 5, 8),
)

AADHAAR_PLACEHOLDER = "[AADHAAR]"
PAN_PLACEHOLDER = "[PAN]"
EMAIL_PLACEHOLDER = "[EMAIL]"

_AADHAAR = re.compile(r"(?<!\d)[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}(?!\d)")
# Fourth letter of a PAN is the holder type (P person, C company, ...).
_PAN = re.compile(r"\b[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]\b", re.IGNORECASE)

# An email address always has a dot after the "@" part; a UPI id (name@bank) does not.
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")

_PAYMENT_LABEL = re.compile(r"utr|rrn|ref|txn|transaction|यूटीआर|संदर्भ|लेनदेन|ट्रांजैक्शन", re.IGNORECASE)
_AADHAAR_LABEL = re.compile(r"aadhaar|aadhar|uidai|\buid\b|आधार", re.IGNORECASE)
_LABEL_WINDOW = 30


def verhoeff_valid(number: str) -> bool:
    check = 0
    for position, char in enumerate(reversed(number)):
        check = _D[check][_P[position % 8][int(char)]]
    return check == 0


def _last_label_end(label: re.Pattern[str], text: str) -> int:
    return max((found.end() for found in label.finditer(text)), default=-1)


def _is_aadhaar(match: re.Match[str], text: str) -> bool:
    # The label closest to the number decides: "UTR 4000... Aadhaar 2341..." is still an Aadhaar.
    before = text[max(0, match.start() - _LABEL_WINDOW) : match.start()]
    payment = _last_label_end(_PAYMENT_LABEL, before)
    aadhaar = _last_label_end(_AADHAAR_LABEL, before)
    if payment != aadhaar:
        return aadhaar > payment
    return verhoeff_valid(re.sub(r"\D", "", match.group()))


def redact_pii(text: str) -> str:
    redacted = _AADHAAR.sub(
        lambda match: AADHAAR_PLACEHOLDER if _is_aadhaar(match, text) else match.group(),
        text,
    )
    return _EMAIL.sub(EMAIL_PLACEHOLDER, _PAN.sub(PAN_PLACEHOLDER, redacted))
