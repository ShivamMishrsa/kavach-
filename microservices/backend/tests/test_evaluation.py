"""The measuring code, and a guard that the rules do not get worse on the labelled sets."""

import pytest

from evaluation.metrics import Outcome, Rate, by_category, entity_scores, percentile, summarise
from evaluation.run import evaluate, load


def outcome(label: str, level: str, **extra) -> Outcome:
    return Outcome(id="x", label=label, category="c", level=level, reasons=(), **extra)


# ----- the metrics -----


def test_a_rate_has_a_value_and_an_interval_that_contains_it():
    rate = Rate(39, 50)
    low, high = rate.interval
    assert rate.value == 0.78 and low < 0.78 < high
    assert "39/50" in rate.show() and "95% CI" in rate.show()


def test_a_rate_over_nothing_says_so_instead_of_dividing_by_zero():
    assert Rate(0, 0).value is None and Rate(0, 0).interval is None
    assert "0 items" in Rate(0, 0).show()


def test_few_items_give_a_wide_interval():
    narrow, wide = Rate(90, 100).interval, Rate(9, 10).interval
    assert wide[1] - wide[0] > narrow[1] - narrow[0]


def test_the_summary_counts_warnings_and_strong_warnings_separately():
    items = [
        outcome("scam", "very_high"),
        outcome("scam", "medium"),
        outcome("scam", "low"),
        outcome("benign", "medium"),
        outcome("benign", "low"),
        outcome("benign", "cannot_verify"),
    ]
    summary = summarise(items)
    assert (summary.recall.hits, summary.recall.total) == (2, 3)
    assert (summary.strong_recall.hits, summary.strong_recall.total) == (1, 3)
    assert (summary.false_alarm.hits, summary.false_alarm.total) == (1, 3)
    assert (summary.strong_false_alarm.hits, summary.strong_false_alarm.total) == (0, 3)
    assert (summary.precision.hits, summary.precision.total) == (2, 3)
    assert (summary.missed_as_low.hits, summary.missed_as_low.total) == (1, 3)
    assert summary.levels["benign"]["cannot_verify"] == 1


def test_a_category_is_right_when_scams_are_warned_and_benign_items_are_not():
    items = [
        Outcome("a", "scam", "kyc", "high", ()),
        Outcome("b", "scam", "kyc", "low", ()),
        Outcome("c", "benign", "otp", "low", ()),
    ]
    rates = by_category(items)
    assert (rates["scam:kyc"].hits, rates["scam:kyc"].total) == (1, 2)
    assert (rates["benign:otp"].hits, rates["benign:otp"].total) == (1, 1)


def test_entities_must_match_exactly():
    expected = {"amount": ["Rs 5,000"], "phone": ["9000011111"]}
    assert entity_scores(expected, {"amount": ["Rs 5,000"], "phone": ["9000011111"]}) == (2, 0, 0)
    assert entity_scores(expected, {"amount": ["Rs 5000"], "phone": ["9000011111"]}) == (1, 1, 1)
    assert entity_scores(expected, {"amount": ["Rs 5,000"], "link": ["x.in"]}) == (1, 1, 1)


def test_percentiles_interpolate():
    values = [1.0, 2.0, 3.0, 4.0]
    assert percentile(values, 0.5) == 2.5
    assert percentile(values, 0.0) == 1.0 and percentile(values, 1.0) == 4.0
    with pytest.raises(ValueError):
        percentile([], 0.5)


# ----- the sets themselves -----


SETS = ["dev", "test", "holdout"]


@pytest.mark.parametrize(
    "name", [f"{split}_{kind}" for split in SETS for kind in ("text", "links")]
)
def test_every_item_is_labelled_and_ids_are_unique(name):
    items = load(name)
    assert items
    assert len({item["id"] for item in items}) == len(items)
    for item in items:
        assert item["label"] in ("scam", "benign") and item["category"]
        assert ("text" in item) != ("url" in item)


def test_the_sets_share_no_message():
    texts = [{item["text"] for item in load(f"{split}_text")} for split in SETS]
    assert not texts[0] & texts[1] and not texts[0] & texts[2] and not texts[1] & texts[2]


# ----- the guard -----


@pytest.fixture(scope="module")
def results():
    return {split: evaluate(split) for split in SETS}


# Scams of the kinds the rules are written for that the holdout set showed they still miss
# (docs/benchmarks.md says why). A new miss is a regression; fixing one means removing it here.
KNOWN_MISSES = {"holdout": {"h002", "h012"}}


@pytest.mark.parametrize("split", SETS)
def test_a_scam_the_rules_are_written_for_is_never_called_low_risk(results, split):
    """The worst mistake. If this fails, a change made the rules say 'low' about a scam."""
    wrong = [row for row in results[split]["wrong"] if row["label"] == "scam"]
    designed = {
        item["id"]
        for item in load(f"{split}_text")
        if item["label"] == "scam" and item["scope"] == "in"
    }
    missed = {row["id"] for row in wrong if row["id"] in designed and row["level"] == "low"}
    assert missed <= KNOWN_MISSES.get(split, set())


@pytest.mark.parametrize("split", SETS)
def test_the_rules_keep_catching_the_scams_they_are_written_for(results, split):
    rate = results[split]["scams_the_rules_are_written_for"]
    assert rate["hits"] / rate["total"] >= (0.90 if split == "holdout" else 0.95)


@pytest.mark.parametrize("split", SETS)
def test_no_ordinary_link_is_warned_about(results, split):
    assert results[split]["links"]["false_alarm"]["hits"] == 0


@pytest.mark.parametrize("split", SETS)
def test_details_are_read_exactly(results, split):
    entities = results[split]["entities"]
    assert entities["fp"] == 0 and entities["fn"] == 0, entities["mistakes"]


def test_old_law_notes_are_right_on_the_test_set(results):
    assert results["test"]["statutes"]["correct"] == results["test"]["statutes"]["total"] > 0


def test_false_alarms_on_everyday_messages_stay_bounded(results):
    """The false alarm rate is high on purpose-built hard cases; on all benign text keep it down."""
    rate = results["test"]["text"]["false_alarm"]
    assert rate["hits"] / rate["total"] <= 0.30
