from app.detection.assess import assess_link, assess_text

FAKE_NOTICE = (
    "Notice: you are under digital arrest. Stay on the video call and do not tell anyone. "
    "Transfer Rs 50,000 immediately to the safe account. "
    "UPI: safe.verification@upi UTR 400000000001 Phone +91 90000 00000. Section 420 IPC."
)
BANK_ALERT = (
    "Rs 1,200 debited from your account on 12/11/2026. "
    "If this was not you, contact your bank branch. Do not share your OTP with anyone."
)


def test_fake_notice_is_very_high_with_every_detail_found():
    result = assess_text(FAKE_NOTICE)
    assert result.risk_level == "very_high"
    assert result.reason_codes == [
        "digital_arrest",
        "safe_account",
        "payment_demand",
        "secrecy",
        "urgency",
        "outdated_section",
    ]
    assert {e.type for e in result.entities} == {"utr", "upi", "phone", "amount"}
    assert [(s.cited, s.current) for s in result.statutes] == [("IPC 420", "BNS 318(4)")]


def test_an_ordinary_bank_alert_is_low():
    result = assess_text(BANK_ALERT)
    assert result.risk_level == "low"
    assert result.reason_codes == []


def test_too_little_text_cannot_be_verified():
    assert assess_text("hi").risk_level == "cannot_verify"
    assert assess_text("   ").risk_level == "cannot_verify"


def test_a_hard_to_read_photo_without_signs_cannot_be_verified():
    assert assess_text(BANK_ALERT, confident=False).risk_level == "cannot_verify"


def test_signs_found_in_a_hard_to_read_photo_still_count():
    assert assess_text("digital arrest " * 3, confident=False).risk_level == "high"


def test_a_link_inside_a_message_is_checked():
    result = assess_text(
        "Your parcel is held, see http://sbi-kyc-update.example/verify to release it."
    )
    assert result.reason_codes == ["lookalike_domain", "insecure_link"]
    assert result.risk_level == "high"


def test_aadhaar_and_pan_never_reach_the_result():
    text = "Aadhaar 2341 2341 2346 and PAN ABCPE1234F. UTR 400000000001. Pay Rs 5000 to a@upi."
    values = [e.value for e in assess_text(text).entities]
    assert "400000000001" in values
    assert all("2341" not in v and "ABCPE" not in v for v in values)


def test_hindi_notice_with_ocr_style_spelling_mistakes():
    text = "आप डजिटिल अरेसूट में हैं। कसी को न बताएं। तुरंत ₹50,000 सुरकषति खाते में ट्रांसफर करें।"
    result = assess_text(text)
    assert result.risk_level == "very_high"
    assert {"digital_arrest", "secrecy", "payment_demand", "safe_account", "urgency"} <= set(
        result.reason_codes
    )


def test_official_link_is_low():
    result = assess_link("https://www.onlinesbi.sbi/login")
    assert result.risk_level == "low"
    assert [(e.type, e.value) for e in result.entities] == [
        ("link", "https://www.onlinesbi.sbi/login")
    ]


def test_unknown_link_cannot_be_verified():
    assert assess_link("https://example.com").risk_level == "cannot_verify"


def test_lookalike_link_is_high():
    result = assess_link("https://sbi-kyc-update.example/verify")
    assert result.risk_level == "high"
    assert result.reason_codes == ["lookalike_domain"]


def test_insecure_lookalike_link_has_both_reasons():
    result = assess_link("http://sbi-kyc-update.example")
    assert result.reason_codes == ["lookalike_domain", "insecure_link"]
