from app.detection.risk import WEIGHTS, ordered, risk_level


def test_digital_arrest_with_a_money_demand_is_very_high():
    assert risk_level({"digital_arrest", "payment_demand"}, enough_to_judge=True) == "very_high"


def test_safe_account_with_a_money_demand_is_very_high():
    assert risk_level({"safe_account", "payment_demand"}, enough_to_judge=True) == "very_high"


def test_digital_arrest_alone_is_high():
    assert risk_level({"digital_arrest"}, enough_to_judge=True) == "high"


def test_a_lookalike_link_alone_is_high():
    assert risk_level({"lookalike_domain"}, enough_to_judge=False) == "high"


def test_payment_with_urgency_is_high():
    assert risk_level({"payment_demand", "urgency"}, enough_to_judge=True) == "high"


def test_a_single_weak_signal_is_medium():
    for code in ("payment_demand", "secrecy", "urgency", "outdated_section", "insecure_link"):
        assert risk_level({code}, enough_to_judge=True) == "medium", code


def test_no_signals_is_low_only_when_there_was_enough_to_judge():
    assert risk_level(set(), enough_to_judge=True) == "low"
    assert risk_level(set(), enough_to_judge=False) == "cannot_verify"


def test_signals_still_count_when_the_text_was_short():
    assert risk_level({"digital_arrest"}, enough_to_judge=False) == "high"


def test_every_reason_has_a_weight_and_a_fixed_order():
    assert ordered(["urgency", "digital_arrest", "payment_demand"]) == [
        "digital_arrest",
        "payment_demand",
        "urgency",
    ]
    assert set(WEIGHTS) == {
        "digital_arrest",
        "payment_demand",
        "safe_account",
        "secrecy",
        "urgency",
        "outdated_section",
        "lookalike_domain",
        "insecure_link",
    }
