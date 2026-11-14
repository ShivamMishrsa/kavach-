"""Old criminal-law names in a notice.

The Bharatiya Nyaya Sanhita (BNS), Bharatiya Nagarik Suraksha Sanhita (BNSS) and Bharatiya
Sakshya Adhiniyam replaced the IPC, the CrPC and the Evidence Act on 1 July 2024. A notice that
quotes the old names is a sign to be careful, not proof: it can legitimately refer to an offence
from before that date.

The section table below holds only the sections most often quoted in scam notices.
It must be checked against the official gazette text before it is relied on (verify).
"""

import re
from typing import Final

from app.detection.text import phrase, skeleton
from app.models import Statute

MAX_STATUTES = 5

# old section -> replacing section
_IPC_TO_BNS: Final[dict[str, str]] = {
    "34": "3(5)",
    "120B": "61(2)",
    "384": "308(2)",
    "406": "316(2)",
    "419": "319(2)",
    "420": "318(4)",
    "467": "338",
    "468": "336(3)",
    "471": "340(2)",
    "506": "351",
}
_CRPC_TO_BNSS: Final[dict[str, str]] = {
    "41A": "35(3)",
    "91": "94",
    "160": "179",
}

_IPC = rf"IPC|Indian\s+Penal\s+Code|{phrase('भारतीय दंड संहिता')}"
_CRPC = rf"Cr\.?\s?P\.?\s?C|Code\s+of\s+Criminal\s+Procedure|{phrase('दंड प्रक्रिया संहिता')}"

_OLD_LAW = re.compile(rf"\b(?:IPC|CrPC)\b|{_IPC}|{_CRPC}|Indian\s+Evidence\s+Act", re.IGNORECASE)

_ACT = rf"(?:(?P<ipc>{_IPC})|(?P<crpc>{_CRPC}))\.?"
_NUMBER = r"(?P<number>\d{1,3}[A-Z]?)(?:\s*\(\d+\))?"
_LABEL = rf"(?:section|sec\.?|u/s|{phrase('धारा')})"
_SECTION_FIRST = re.compile(rf"{_LABEL}\s*{_NUMBER}\s*(?:of\s+(?:the\s+)?)?{_ACT}", re.IGNORECASE)
_ACT_FIRST = re.compile(rf"{_ACT}\s*(?:{_LABEL})?\s*{_NUMBER}", re.IGNORECASE)


def mentions_old_law(text: str) -> bool:
    return _OLD_LAW.search(skeleton(text)) is not None


def find_statutes(text: str) -> list[Statute]:
    """Quoted sections that have a known replacement, in the order they appear."""
    comparable = skeleton(text)
    hits = sorted(
        (m for pattern in (_SECTION_FIRST, _ACT_FIRST) for m in pattern.finditer(comparable)),
        key=lambda match: match.start(),
    )
    found: dict[str, Statute] = {}
    for match in hits:
        number = match.group("number").upper()
        if match.group("ipc"):
            cited, replacement, new_act = f"IPC {number}", _IPC_TO_BNS.get(number), "BNS"
        else:
            cited, replacement, new_act = f"CrPC {number}", _CRPC_TO_BNSS.get(number), "BNSS"
        if replacement:
            found.setdefault(cited, Statute(cited=cited, current=f"{new_act} {replacement}"))
    return list(found.values())[:MAX_STATUTES]
