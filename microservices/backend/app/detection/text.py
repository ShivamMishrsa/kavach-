"""Matching Hindi text that comes out of OCR.

OCR often gets the small vowel signs (matras) of Devanagari wrong: "डिजिटल अरेस्ट" can come out as
"डजिटिल अरेसूट". Both sides are therefore compared with those signs removed: the consonants are
what OCR gets right. Latin letters and digits pass through unchanged.
"""

import re
import unicodedata
from typing import Final

# Cyrillic and Greek letters that look like Latin ones.
CONFUSABLES: Final = {
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


def undisguised(text: str) -> str:
    """The text as a person reads it, without the tricks used to slip past a filter.

    Full-width and other "compatibility" letters become ordinary ones, invisible characters (a
    zero-width space inside a word) are dropped, and Cyrillic or Greek letters that look Latin
    are turned into Latin. Used for finding scam wording, not for the details that are shown.
    """
    kept = "".join(
        char
        for char in unicodedata.normalize("NFKC", text)
        if unicodedata.category(char) != "Cf" and (char in ("\n", "\t") or char.isprintable())
    )
    return kept.translate(CONFUSABLES)
