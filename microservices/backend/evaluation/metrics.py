"""The numbers reported for the detection rules: counts, rates and their uncertainty.

Small test sets give wide uncertainty, so every rate comes with a 95% Wilson interval and the
number of items it is based on. Nothing here talks to the detection code.
"""

import math
from collections.abc import Iterable, Mapping
from dataclasses import dataclass

# "Warned": Kavach said something is off (medium or higher). "Strongly warned": high or very high.
WARNED = frozenset({"medium", "high", "very_high"})
STRONG = frozenset({"high", "very_high"})
LEVELS = ("very_high", "high", "medium", "cannot_verify", "low")


@dataclass(frozen=True)
class Rate:
    """`hits` out of `total`, with a 95% Wilson score interval."""

    hits: int
    total: int

    @property
    def value(self) -> float | None:
        return self.hits / self.total if self.total else None

    @property
    def interval(self) -> tuple[float, float] | None:
        if not self.total:
            return None
        z = 1.96
        n, p = self.total, self.hits / self.total
        centre = (p + z * z / (2 * n)) / (1 + z * z / n)
        spread = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
        return max(0.0, centre - spread), min(1.0, centre + spread)

    def show(self) -> str:
        if not self.total:
            return "n/a (0 items)"
        low, high = self.interval or (0.0, 0.0)
        return f"{self.value:.0%} ({self.hits}/{self.total}, 95% CI {low:.0%}-{high:.0%})"


@dataclass(frozen=True)
class Outcome:
    """What the rules said about one labelled item."""

    id: str
    label: str  # "scam" or "benign"
    category: str
    level: str
    reasons: tuple[str, ...]
    hard: bool = False  # a benign message that uses scam-like words on purpose
    scope: str = "in"  # "in" when the rules were written for this kind of scam

    @property
    def warned(self) -> bool:
        return self.level in WARNED

    @property
    def strongly_warned(self) -> bool:
        return self.level in STRONG


@dataclass(frozen=True)
class Summary:
    recall: Rate  # scams that were warned about
    false_alarm: Rate  # benign items that were warned about
    precision: Rate  # warned items that were scams
    strong_recall: Rate  # scams that got a strong warning
    strong_false_alarm: Rate  # benign items that got a strong warning
    missed_as_low: Rate  # scams answered "low risk" (the worst mistake)
    cannot_verify: Rate  # all items answered "could not verify"
    levels: Mapping[str, Mapping[str, int]]  # label -> level -> count


def summarise(outcomes: Iterable[Outcome]) -> Summary:
    items = list(outcomes)
    scams = [item for item in items if item.label == "scam"]
    benign = [item for item in items if item.label == "benign"]
    warned = [item for item in items if item.warned]
    levels = {"scam": dict.fromkeys(LEVELS, 0), "benign": dict.fromkeys(LEVELS, 0)}
    for item in items:
        levels[item.label][item.level] += 1
    return Summary(
        recall=Rate(sum(item.warned for item in scams), len(scams)),
        false_alarm=Rate(sum(item.warned for item in benign), len(benign)),
        precision=Rate(sum(item.label == "scam" for item in warned), len(warned)),
        strong_recall=Rate(sum(item.strongly_warned for item in scams), len(scams)),
        strong_false_alarm=Rate(sum(item.strongly_warned for item in benign), len(benign)),
        missed_as_low=Rate(sum(item.level == "low" for item in scams), len(scams)),
        cannot_verify=Rate(sum(item.level == "cannot_verify" for item in items), len(items)),
        levels=levels,
    )


def by_category(outcomes: Iterable[Outcome]) -> dict[str, Rate]:
    """For each category, how many items were handled as labelled (scam warned, benign not)."""
    groups: dict[str, list[Outcome]] = {}
    for item in outcomes:
        groups.setdefault(f"{item.label}:{item.category}", []).append(item)
    return {
        name: Rate(sum(item.warned == (item.label == "scam") for item in group), len(group))
        for name, group in sorted(groups.items())
    }


def entity_scores(
    expected: Mapping[str, Iterable[str]], found: Mapping[str, Iterable[str]]
) -> tuple[int, int, int]:
    """(true positives, false positives, false negatives) when each value must match exactly."""
    true = false_pos = false_neg = 0
    for kind in set(expected) | set(found):
        want, got = set(expected.get(kind, ())), set(found.get(kind, ()))
        true += len(want & got)
        false_pos += len(got - want)
        false_neg += len(want - got)
    return true, false_pos, false_neg


def percentile(values: list[float], fraction: float) -> float:
    """The value at `fraction` (0.5 = median, 0.95 = p95) by linear interpolation."""
    if not values:
        raise ValueError("no values")
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    low, high = math.floor(position), math.ceil(position)
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)
