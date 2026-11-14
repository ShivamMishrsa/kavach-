"""Turns the signals found into one of five risk levels.

Every signal has a weight, and the level comes from the total. This is deliberately plain so a
person can follow why a result came out as it did. It is a risk level, never a verdict.

    total 5 or more  -> very_high   (for example digital arrest + a money demand)
    total 3 or 4     -> high        (for example a look-alike bank link, or payment + urgency)
    total 1 or 2     -> medium
    total 0          -> low, but only if there was enough to judge; otherwise cannot_verify
"""

from collections.abc import Iterable
from typing import Final

from app.models import ReasonCode, RiskLevel

# The order here is also the order the reasons are shown in.
WEIGHTS: Final[dict[ReasonCode, int]] = {
    "digital_arrest": 3,
    "safe_account": 3,
    "lookalike_domain": 3,
    "payment_demand": 2,
    "secrecy": 1,
    "urgency": 1,
    "outdated_section": 1,
    "insecure_link": 1,
}


def ordered(reasons: Iterable[ReasonCode]) -> list[ReasonCode]:
    found = set(reasons)
    return [code for code in WEIGHTS if code in found]


def risk_level(reasons: Iterable[ReasonCode], *, enough_to_judge: bool) -> RiskLevel:
    total = sum(WEIGHTS[code] for code in set(reasons))
    if total >= 5:
        return "very_high"
    if total >= 3:
        return "high"
    if total >= 1:
        return "medium"
    return "low" if enough_to_judge else "cannot_verify"
