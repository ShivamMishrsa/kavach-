"""Measures the detection rules on the labelled sets.

    python -m evaluation.run                 # both sets, readable report
    python -m evaluation.run --split test    # one set
    python -m evaluation.run --json out.json # also write the numbers to a file

The sets are written by the project team (nothing here is a real person's message): the `dev`
set is what the rules were tuned on, the `test` set was written afterwards and is what to quote.
Read `docs/benchmarks.md` for what the numbers do and do not mean.
"""

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

from app.detection.assess import assess_link, assess_text
from app.detection.entities import extract_entities
from app.detection.links import normalize_url
from app.detection.pii import redact_pii
from app.detection.statutes import find_statutes
from app.models import ScanResult
from evaluation.metrics import Outcome, Rate, Summary, by_category, entity_scores, summarise

DATA = Path(__file__).parent / "data"
SPLITS = ("dev", "test", "holdout")


def load(name: str) -> list[dict]:
    path = DATA / f"{name}.jsonl"
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text("utf-8").splitlines() if line.strip()]


def assess(item: dict) -> ScanResult:
    if "url" in item:
        url = normalize_url(item["url"])
        if url is None:
            raise ValueError(f"{item['id']}: not a link")
        return assess_link(url)
    return assess_text(item["text"])


def outcome(item: dict, result: ScanResult) -> Outcome:
    return Outcome(
        id=item["id"],
        label=item["label"],
        category=item["category"],
        level=result.risk_level,
        reasons=tuple(result.reason_codes),
        hard=item.get("hard", False),
        scope=item.get("scope", "in"),
    )


def _rate(rate: Rate) -> dict:
    return {"hits": rate.hits, "total": rate.total, "value": rate.value, "interval": rate.interval}


def _summary(summary: Summary) -> dict:
    return {
        "recall": _rate(summary.recall),
        "false_alarm": _rate(summary.false_alarm),
        "precision": _rate(summary.precision),
        "strong_recall": _rate(summary.strong_recall),
        "strong_false_alarm": _rate(summary.strong_false_alarm),
        "missed_as_low": _rate(summary.missed_as_low),
        "cannot_verify": _rate(summary.cannot_verify),
        "levels": {label: dict(counts) for label, counts in summary.levels.items()},
    }


def _entities(texts: list[dict]) -> dict:
    """Exact-match entity extraction on the messages that were annotated."""
    totals = {"tp": 0, "fp": 0, "fn": 0}
    mistakes = []
    for item in texts:
        if "entities" not in item:
            continue
        expected: dict[str, list[str]] = defaultdict(list)
        for entity in item["entities"]:
            expected[entity["type"]].append(entity["value"])
        found: dict[str, list[str]] = defaultdict(list)
        for entity in extract_entities(redact_pii(item["text"])):
            found[entity.type].append(entity.value)
        tp, fp, fn = entity_scores(expected, found)
        totals["tp"] += tp
        totals["fp"] += fp
        totals["fn"] += fn
        if fp or fn:
            mistakes.append({"id": item["id"], "expected": expected, "found": found})
    return {
        **totals,
        "precision": _rate(Rate(totals["tp"], totals["tp"] + totals["fp"])),
        "recall": _rate(Rate(totals["tp"], totals["tp"] + totals["fn"])),
        "mistakes": mistakes,
    }


def _statutes(texts: list[dict]) -> dict:
    """The old-law notes (IPC to BNS) on the messages that were annotated."""
    annotated = [item for item in texts if "statutes" in item]
    mistakes = []
    for item in annotated:
        found = sorted((s.cited, s.current) for s in find_statutes(item["text"]))
        if found != sorted(tuple(pair) for pair in item["statutes"]):
            mistakes.append({"id": item["id"], "expected": item["statutes"], "found": found})
    return {
        "correct": len(annotated) - len(mistakes),
        "total": len(annotated),
        "mistakes": mistakes,
    }


def evaluate(split: str) -> dict:
    """All the numbers for one split."""
    texts = load(f"{split}_text")
    links = load(f"{split}_links")
    text_outcomes = [outcome(item, assess(item)) for item in texts]
    link_outcomes = [outcome(item, assess(item)) for item in links]
    everything = text_outcomes + link_outcomes

    scams = [o for o in text_outcomes if o.label == "scam"]
    benign = [o for o in text_outcomes if o.label == "benign"]
    designed = [o for o in scams if o.scope == "in"]
    not_designed = [o for o in scams if o.scope == "out"]
    hard = [o for o in benign if o.hard]
    return {
        "split": split,
        "counts": {"text": len(texts), "links": len(links)},
        "all": _summary(summarise(everything)),
        "text": _summary(summarise(text_outcomes)),
        "links": _summary(summarise(link_outcomes)),
        "scams_the_rules_are_written_for": _rate(
            Rate(sum(o.warned for o in designed), len(designed))
        ),
        "scams_the_rules_are_not_written_for": _rate(
            Rate(sum(o.warned for o in not_designed), len(not_designed))
        ),
        "hard_benign_warned": _rate(Rate(sum(o.warned for o in hard), len(hard))),
        "hard_benign_strongly_warned": _rate(Rate(sum(o.strongly_warned for o in hard), len(hard))),
        "categories": {name: _rate(rate) for name, rate in by_category(everything).items()},
        "entities": _entities(texts),
        "statutes": _statutes(texts),
        "wrong": [
            {
                "id": o.id,
                "label": o.label,
                "category": o.category,
                "level": o.level,
                "reasons": list(o.reasons),
            }
            for o in everything
            if o.warned != (o.label == "scam")
        ],
    }


def _line(label: str, rate: dict) -> str:
    return f"  {label:<40} {Rate(rate['hits'], rate['total']).show()}"


def report(result: dict) -> str:
    counts = result["counts"]
    lines = [f"== {result['split']} ({counts['text']} messages, {counts['links']} links)"]
    for part in ("text", "links"):
        summary = result[part]
        lines.append(f" {part}:")
        for key, label in (
            ("recall", "scams warned about (recall)"),
            ("false_alarm", "benign warned about (false alarms)"),
            ("precision", "warnings that were scams (precision)"),
            ("strong_recall", "scams strongly warned about"),
            ("strong_false_alarm", "benign strongly warned about"),
            ("missed_as_low", 'scams answered "low risk"'),
        ):
            lines.append(_line(label, summary[key]))
    lines.append(
        _line("scams the rules are written for", result["scams_the_rules_are_written_for"])
    )
    lines.append(
        _line("scams the rules are NOT written for", result["scams_the_rules_are_not_written_for"])
    )
    lines.append(_line("hard benign messages warned about", result["hard_benign_warned"]))
    entities = result["entities"]
    lines.append(_line("entity precision (exact match)", entities["precision"]))
    lines.append(_line("entity recall (exact match)", entities["recall"]))
    statutes = result["statutes"]
    lines.append(f"  {'old-law notes correct':<40} {statutes['correct']}/{statutes['total']}")
    if result["wrong"]:
        lines.append(" mistakes:")
        for row in result["wrong"]:
            reasons = ", ".join(row["reasons"])
            lines.append(
                f"  {row['id']:<5} {row['label']:<7} {row['category']:<16}"
                f" -> {row['level']:<13} {reasons}"
            )
    for row in entities["mistakes"]:
        lines.append(
            f"  entities {row['id']}: expected {dict(row['expected'])} found {dict(row['found'])}"
        )
    for row in statutes["mistakes"]:
        lines.append(f"  statutes {row['id']}: expected {row['expected']} found {row['found']}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--split", choices=(*SPLITS, "all"), default="all")
    parser.add_argument("--json", type=Path, help="also write the numbers to this file")
    args = parser.parse_args(argv)

    splits = SPLITS if args.split == "all" else (args.split,)
    results = [
        evaluate(split) for split in splits if load(f"{split}_text") or load(f"{split}_links")
    ]
    for result in results:
        print(report(result), end="\n\n")
    if args.json:
        args.json.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
