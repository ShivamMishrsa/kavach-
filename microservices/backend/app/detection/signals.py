"""Scam signals found in the wording of a message or notice.

Each signal is a list of plain patterns (English, Hinglish and Hindi). A signal is a reason to be
careful, never proof: the risk level comes from combining signals in `risk.py`.
Patterns avoid phrases that honest bank messages also use (for example "do not share your OTP
with anyone" is a warning, not secrecy pressure).
"""

import re
from typing import Final

from app.detection.text import phrase, skeleton, undisguised
from app.models import ReasonCode

_AMOUNT = r"(?:₹|\brs\b\.?|\binr\b)"
_VIDEO_CALL = rf"(?:(?:video|skype|whatsapp|zoom)\s*call|{phrase('वीडियो कॉल')})"
# Whole words: "warranty" is not a warrant. "giraft..." is Hindi written in English letters.
_ARREST = (
    r"(?:\b(?:arrest\w*|custody|investigation|interrogation|warrants?|giraft\w*)\b"
    rf"|{phrase('गिरफ्तार', 'हिरासत', 'जांच', 'जाँच')})"
)
# "investigation" and "जांच" are weaker words (an honest message can use them), so only these count
# when the threat is in a different sentence from the video call.
_ARREST_STRONG = (
    r"(?:\b(?:arrest\w*|custody|warrants?|giraft\w*)\b"
    rf"|{phrase('गिरफ्तार', 'हिरासत', 'वारंट')})"
)
_OFFICIAL = (
    r"(?:\b(?:police|cbi|enforcement directorate|narcotics|customs|cyber\s*(?:crime|cell|police)"
    r"|court|inspector)\b"
    rf"|{phrase('पुलिस', 'सीबीआई', 'अदालत')})"
)
_GAP = r"[^.।\n]"  # stay inside one sentence
_NEXT_SENTENCE = r"[^\n]{0,100}"  # a threat often comes in the sentence after the video call
_HI_CURRENCY = rf"(?:₹|{phrase('रुपये', 'रुपए')})"
_HI_PAY = phrase("जमा", "ट्रांसफर", "भुगतान", "भेज")
_HI_STAY = phrase("चालू रख", "पर रह", "से जुड़े रह", "जुड़े रह")
_OR_ELSE = (
    r"(?:\b(?:warna|nahi\s+to|nahin\s+to|otherwise|or\s+else)\b" rf"|{phrase('वरना', 'नहीं तो')})"
)

_PATTERNS: Final[dict[ReasonCode, tuple[str, ...]]] = {
    "digital_arrest": (
        rf"digital\s*arrest|{phrase('डिजिटल अरेस्ट')}",
        rf"{_VIDEO_CALL}{_GAP}{{0,80}}{_ARREST}",
        rf"{_ARREST}{_GAP}{{0,80}}{_VIDEO_CALL}",
        rf"{_VIDEO_CALL}{_NEXT_SENTENCE}{_ARREST_STRONG}",
        rf"{_ARREST_STRONG}{_NEXT_SENTENCE}{_VIDEO_CALL}",
        # "Remain on the video call" said by someone claiming to be the police, CBI or a court.
        rf"{_OFFICIAL}[^\n]{{0,200}}\b(?:stay|remain|keep|continue)\b{_GAP}{{0,30}}{_VIDEO_CALL}",
        # The same in Hindi, where the verb comes after the call: "वीडियो कॉल चालू रखिए".
        rf"{_OFFICIAL}[^\n]{{0,200}}{_VIDEO_CALL}{_GAP}{{0,20}}{_HI_STAY}",
        # "Come on the video call, or else ...": a threat that names no arrest.
        rf"{_OFFICIAL}[^\n]{{0,200}}{_VIDEO_CALL}[^\n]{{0,60}}{_OR_ELSE}",
    ),
    "payment_demand": (
        rf"\b(?:transfer|send|pay|deposit|remit)\b{_GAP}{{0,60}}?(?:{_AMOUNT}|\brupees?\b)\s?\d",
        rf"\b(?:transfer|send|pay|deposit|remit)\b{_GAP}{{0,40}}\d\s?(?:rupees|rupaye)\b",
        rf"{_AMOUNT}\s?\d[\d,]*{_GAP}{{0,40}}\b(?:transfer|deposit|pay|send)\b",
        rf"\b\d[\d,]*\s?(?:rupees|rupaye)\b{_GAP}{{0,40}}\b(?:transfer|deposit|pay|send|bhej\w*)\b",
        rf"{_HI_CURRENCY}\s?[\d,]*{_GAP}{{0,40}}{_HI_PAY}",
        rf"{_HI_PAY}{_GAP}{{0,40}}{_HI_CURRENCY}",
    ),
    "safe_account": (
        r"\b(?:safe|verification|rbi|escrow|supervision)\s+(?:bank\s+)?(?:account|a/c)\b",
        rf"\b(?:verify|verification)\b{_GAP}{{0,40}}\b(?:funds|money|balance)\b",
        phrase(
            "सुरक्षित खाता",
            "सुरक्षित बैंक खाता",
            "वेरिफिकेशन खाता",
            "सत्यापन खाता",
            "आरबीआई खाता",
            "निगरानी खाता",
        ),
    ),
    "secrecy": (
        r"\b(?:don'?t|do not|never|must not|should not)\s+(?:tell|inform|discuss|disclose)\b"
        rf"{_GAP}{{0,40}}\b(?:anyone|anybody|no\s?one|family|relatives|others|police|bank)\b",
        r"\btell\s+(?:no\s?one|nobody)\b",
        rf"\bkeep\b{_GAP}{{0,20}}\b(?:secret|confidential)\b",
        r"\b(?:secret|confidential)\s+(?:case|matter|investigation|operation)\b",
        # Hindi in English letters: "kisi ko mat batana", "family ko bhi nahi batana".
        r"\b(?:kisi|family|ghar|parivar|police|bank)\w*(?:\s+\w+){0,2}\s+(?:mat|nahi|nahin)\s+bata",
        rf"{phrase('किसी को')}\s*{phrase('भी')}?\s*{phrase('न', 'नहीं', 'ना')}\s*{phrase('बता')}",
        phrase("गोपनीय रख", "गुप्त रख"),
    ),
    "urgency": (
        r"\b(?:immediately|urgent(?:ly)?|right now|asap|last warning|final (?:notice|warning))\b",
        r"\b(?:turant|fauran)\b",
        r"\bwithin\s+\d+\s*(?:minutes?|mins?|hours?|hrs?)\b",
        r"\b(?:will be|shall be)\s+arrested\b",
        r"\barrest\s+warrant\b|\bwarrant\s+(?:has been|is|will be)\s+issued\b",
        phrase("तुरंत", "फौरन", "आखिरी चेतावनी", "आखिरी मौका", "गिरफ्तार", "वारंट"),
    ),
}

_COMPILED: Final[dict[ReasonCode, tuple[re.Pattern[str], ...]]] = {
    code: tuple(re.compile(pattern, re.IGNORECASE) for pattern in patterns)
    for code, patterns in _PATTERNS.items()
}


# "A fixed deposit of Rs 1,00,000" names an account type; it does not ask anyone to deposit.
_NOUN_DEPOSIT = re.compile(r"\b(?:fixed|recurring|security|term)\s+deposits?\b", re.IGNORECASE)
# "I will transfer Rs 800 tonight" is somebody offering to pay, not a demand for money.
_OFFER_TO_PAY = re.compile(
    r"\b(?:i|we)(?:\s+will|'ll|\s+shall|\s+can|\s+am going to)\s+(?:transfer|send|pay|deposit)\b",
    re.IGNORECASE,
)


# "₹12,000 जमा हुए हैं" says money arrived. It is a bank's credit alert, not a demand to deposit.
_CREDITED = re.compile(phrase("जमा हो", "जमा की गई", "जमा किए गए"))
# "Your OTP is 3382. Kisi ko mat batayein" is the bank's own warning, not secrecy pressure.
_OTP_WARNING = re.compile(
    r"\b(?:otp|pin|cvv|password)\b[^\n]{0,40}\b(?:kisi|family)\w*(?:\s+\w+){0,2}"
    r"\s+(?:mat|nahi|nahin)\s+bata\w*",
    re.IGNORECASE,
)


def detect_signals(text: str) -> set[ReasonCode]:
    comparable = skeleton(undisguised(text))
    without_offers = _CREDITED.sub(" ", _NOUN_DEPOSIT.sub(" ", _OFFER_TO_PAY.sub(" ", comparable)))
    judged = {"payment_demand": without_offers, "secrecy": _OTP_WARNING.sub(" ", comparable)}
    return {
        code
        for code, patterns in _COMPILED.items()
        if any(pattern.search(judged.get(code, comparable)) for pattern in patterns)
    }
