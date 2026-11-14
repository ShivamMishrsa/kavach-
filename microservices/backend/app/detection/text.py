"""Matching Hindi text that comes out of OCR.

OCR often gets the small vowel signs (matras) of Devanagari wrong: "डिजिटल अरेस्ट" can come out as
"डजिटिल अरेसूट". Both sides are therefore compared with those signs removed: the consonants are
what OCR gets right. Latin letters and digits pass through unchanged.
"""

import re
import unicodedata

_DEVANAGARI = range(0x0900, 0x0980)


def skeleton(text: str) -> str:
    """The text without Devanagari vowel signs, nukta, virama and the like."""
    return "".join(
        char
        for char in unicodedata.normalize("NFC", text)
        if not (ord(char) in _DEVANAGARI and unicodedata.category(char).startswith("M"))
    )


def phrase(*phrases: str) -> str:
    """A regex that matches any of the Hindi phrases in skeleton form, spaces optional."""
    options = (r"\s*".join(re.escape(word) for word in skeleton(p).split()) for p in phrases)
    return "(?:" + "|".join(options) + ")"
