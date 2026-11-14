"""Scam signals found in the wording of a message or notice.

Each signal is a list of plain patterns (English, Hinglish and Hindi). A signal is a reason to be
careful, never proof: the risk level comes from combining signals in `risk.py`.
Patterns avoid phrases that honest bank messages also use (for example "do not share your OTP
with anyone" is a warning, not secrecy pressure).
"""

import re
from typing import Final

from app.detection.text import phrase, skeleton
from app.models import ReasonCode

_AMOUNT = r"(?:₹|\brs\b\.?|\binr\b)"
_VIDEO_CALL = rf"(?:(?:video|skype|whatsapp|zoom)\s*call|{phrase('वीडियो कॉल')})"
_ARREST = (
    r"(?:arrest|custody|investigation|interrogation|warrant"
    rf"|{phrase('गिरफ्तार', 'हिरासत', 'जांच', 'जाँच')})"
)
_GAP = r"[^.।\n]"  # stay inside one sentence
_HI_CURRENCY = rf"(?:₹|{phrase('रुपये', 'रुपए')})"
_HI_PAY = phrase("जमा", "ट्रांसफर", "भुगतान", "भेज")

_PATTERNS: Final[dict[ReasonCode, tuple[str, ...]]] = {
    "digital_arrest": (
        rf"digital\s*arrest|{phrase('डिजिटल अरेस्ट')}",
        rf"{_VIDEO_CALL}{_GAP}{{0,80}}{_ARREST}",
        rf"{_ARREST}{_GAP}{{0,80}}{_VIDEO_CALL}",
    ),
    "payment_demand": (
        rf"\b(?:transfer|send|pay|deposit|remit)\b{_GAP}{{0,60}}?(?:{_AMOUNT}|\brupees?\b)\s?\d",
        rf"\b(?:transfer|send|pay|deposit|remit)\b{_GAP}{{0,40}}\d\s?(?:rupees|rupaye)\b",
        rf"{_AMOUNT}\s?\d[\d,]*{_GAP}{{0,40}}\b(?:transfer|deposit|pay|send)\b",
        rf"{_HI_CURRENCY}\s?[\d,]*{_GAP}{{0,40}}{_HI_PAY}",
        rf"{_HI_PAY}{_GAP}{{0,40}}{_HI_CURRENCY}",
    ),
    "safe_account": (
        r"\b(?:safe|verification|rbi|escrow|supervision)\s+(?:bank\s+)?(?:account|a/c)\b",
        rf"\b(?:verify|verification)\b{_GAP}{{0,40}}\b(?:funds|money|balance)\b",
        phrase("सुरक्षित खाता", "सुरक्षित बैंक खाता", "वेरिफिकेशन खाता", "सत्यापन खाता", "आरबीआई खाता"),
    ),
    "secrecy": (
        r"\b(?:don'?t|do not|never|must not|should not)\s+(?:tell|inform|discuss|disclose)\b"
        rf"{_GAP}{{0,40}}\b(?:anyone|anybody|no\s?one|family|relatives|others|police|bank)\b",
        r"\btell\s+(?:no\s?one|nobody)\b",
        rf"\bkeep\b{_GAP}{{0,20}}\b(?:secret|confidential)\b",
        r"\b(?:secret|confidential)\s+(?:case|matter|investigation|operation)\b",
        rf"{phrase('किसी को')}\s*{phrase('भी')}?\s*{phrase('न', 'नहीं', 'ना')}\s*{phrase('बता')}",
        phrase("गोपनीय रख", "गुप्त रख"),
    ),
    "urgency": (
        r"\b(?:immediately|urgent(?:ly)?|right now|asap|last warning|final (?:notice|warning))\b",
        r"\bwithin\s+\d+\s*(?:minutes?|mins?|hours?|hrs?)\b",
        r"\b(?:will be|shall be)\s+arrested\b",
        r"\barrest\s+warrant\b|\bwarrant\s+(?:has been|is)\s+issued\b",
        phrase("तुरंत", "फौरन", "आखिरी चेतावनी", "आखिरी मौका", "गिरफ्तार", "वारंट"),
    ),
}

_COMPILED: Final[dict[ReasonCode, tuple[re.Pattern[str], ...]]] = {
    code: tuple(re.compile(pattern, re.IGNORECASE) for pattern in patterns)
    for code, patterns in _PATTERNS.items()
}


def detect_signals(text: str) -> set[ReasonCode]:
    comparable = skeleton(text)
    return {
        code
        for code, patterns in _COMPILED.items()
        if any(pattern.search(comparable) for pattern in patterns)
    }
