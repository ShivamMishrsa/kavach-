from app.detection.entities import MAX_PER_TYPE, extract_entities


def found(text: str) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for entity in extract_entities(text):
        result.setdefault(entity.type, []).append(entity.value)
    return result


def test_the_full_notice_example():
    text = (
        "Transfer ₹50,000 to safe.verification@upi. UTR 400000000001. "
        "Call +91 90000 00000 before 12/11/2026 at 3:30 PM. Visit https://sbi-kyc.example/verify."
    )
    assert found(text) == {
        "utr": ["400000000001"],
        "upi": ["safe.verification@upi"],
        "phone": ["+91 90000 00000"],
        "amount": ["₹50,000"],
        "datetime": ["12/11/2026 at 3:30 PM"],
        "link": ["https://sbi-kyc.example/verify"],
    }


def test_amount_does_not_take_the_sentence_comma():
    assert found("You must pay Rs. 50,000, today.")["amount"] == ["Rs. 50,000"]


def test_amount_in_words_and_with_decimals():
    assert found("send 5000 rupees")["amount"] == ["5000 rupees"]
    assert found("INR 1,25,000.50 received")["amount"] == ["INR 1,25,000.50"]


def test_utr_after_different_labels():
    for text in (
        "UTR: 400000000001",
        "UTR No. 400000000001",
        "UPI Ref No 400000000001",
        "Transaction ID: 400000000001",
        "UTR number is 400000000001",
        "यूटीआर 400000000001",
    ):
        assert found(text)["utr"] == ["400000000001"], text


def test_alphanumeric_utr_after_a_label():
    assert found("UTR SBIN526123456789")["utr"] == ["SBIN526123456789"]


def test_a_word_after_a_label_is_not_a_utr():
    assert "utr" not in found("Reference: Authorization")


def test_bare_twelve_digit_number_is_a_utr():
    assert found("paid, number 400000000001 ok")["utr"] == ["400000000001"]


def test_a_utr_is_not_also_read_as_a_phone_number():
    assert "phone" not in found("UTR 612345678901")
    assert "phone" not in found("612345678901")


def test_phone_formats():
    for text, expected in (
        ("call 9000000000", "9000000000"),
        ("call 90000 00000", "90000 00000"),
        ("call +91 9000000000", "+91 9000000000"),
        ("call 09000000000", "09000000000"),
        ("call 90000-00000", "90000-00000"),
    ):
        assert found(text)["phone"] == [expected], text


def test_a_number_starting_below_six_is_not_a_phone():
    assert "phone" not in found("call 1234567890")


def test_upi_ids_but_not_email_addresses():
    assert found("pay to ramesh.k-1@okhdfcbank now")["upi"] == ["ramesh.k-1@okhdfcbank"]
    assert "upi" not in found("mail me at ramesh@gmail.com")


def test_links_without_a_scheme_and_trailing_punctuation():
    assert found("see www.example.com/pay.")["link"] == ["www.example.com/pay"]
    assert found("(http://a.example/x)")["link"] == ["http://a.example/x"]


def test_digits_inside_a_link_are_not_read_as_a_phone_number():
    assert "phone" not in found("https://a.example/9000000000")


def test_repeats_are_collapsed_and_capped():
    assert found("9000000000 and 9000000000")["phone"] == ["9000000000"]
    many = " ".join(f"9{i:09d}" for i in range(20))
    assert len(found(many)["phone"]) == MAX_PER_TYPE


def test_nothing_found():
    assert extract_entities("hello, nothing to see here") == []


def test_an_address_without_http_is_found_when_it_ends_like_a_real_one():
    assert found("Reactivate at uidai-update.xyz/login now")["link"] == ["uidai-update.xyz/login"]
    assert found("visit sbi.co.in.")["link"] == ["sbi.co.in"]


def test_ordinary_text_with_dots_is_not_a_link():
    assert "link" not in found("See e.g. the list, Mr.Sharma agreed and ravi@gmail.com wrote")


def test_a_labelled_reference_number_is_not_a_phone_number():
    assert "phone" not in found("PNR 8123456789 confirmed")
    assert found("Call 9876543210")["phone"] == ["9876543210"]
