from app.detection.entities import extract_entities
from app.detection.pii import AADHAAR_PLACEHOLDER, PAN_PLACEHOLDER, redact_pii, verhoeff_valid


def with_check_digit(prefix: str) -> str:
    """Appends the Verhoeff check digit, so the result is a number that passes the check."""
    for digit in range(10):
        if verhoeff_valid(prefix + str(digit)):
            return prefix + str(digit)
    raise AssertionError("no check digit")


AADHAAR = with_check_digit("23412341234")  # 12 digits, passes the check
NOT_AADHAAR = "400000000001"  # fails the check, so it cannot be an Aadhaar number


def test_verhoeff_known_vector():
    # The textbook example: 236 has check digit 3.
    assert verhoeff_valid("2363")
    assert not verhoeff_valid("2364")


def test_test_numbers_are_what_the_tests_assume():
    assert len(AADHAAR) == 12 and verhoeff_valid(AADHAAR)
    assert len(NOT_AADHAAR) == 12 and not verhoeff_valid(NOT_AADHAAR)


def test_aadhaar_with_a_label_is_redacted():
    assert redact_pii(f"Aadhaar: {AADHAAR}") == f"Aadhaar: {AADHAAR_PLACEHOLDER}"


def test_labelled_aadhaar_is_redacted_even_when_the_digits_do_not_pass_the_check():
    # A typo or an OCR slip must not leave a labelled Aadhaar number in the text.
    assert AADHAAR_PLACEHOLDER in redact_pii(f"आधार {NOT_AADHAAR}")


def test_grouped_aadhaar_is_redacted():
    grouped = f"{AADHAAR[:4]} {AADHAAR[4:8]} {AADHAAR[8:]}"
    assert redact_pii(f"id {grouped}") == f"id {AADHAAR_PLACEHOLDER}"


def test_a_number_that_cannot_be_aadhaar_is_kept():
    assert redact_pii(f"Paid 5000, ID {NOT_AADHAAR}") == f"Paid 5000, ID {NOT_AADHAAR}"


def test_utr_is_never_taken_for_aadhaar_even_when_it_passes_the_check():
    # The bug this module exists to prevent: a UPI reference that looks like an Aadhaar number.
    for label in ("UTR", "UTR No:", "UPI Ref", "Transaction ID", "यूटीआर", "Ref. no."):
        text = f"{label} {AADHAAR}"
        assert redact_pii(text) == text, label


def test_utr_survives_redaction_and_is_then_extracted():
    text = f"Sent Rs 5000. UTR {AADHAAR}. Aadhaar {with_check_digit('34512345123')}"
    clean = redact_pii(text)
    assert AADHAAR_PLACEHOLDER in clean
    utrs = [e.value for e in extract_entities(clean) if e.type == "utr"]
    assert utrs == [AADHAAR]


def test_the_label_closest_to_the_number_decides():
    other = with_check_digit("34512345123")
    clean = redact_pii(f"UTR {NOT_AADHAAR} Aadhaar {other}")
    assert NOT_AADHAAR in clean
    assert other not in clean


def test_pan_is_redacted():
    assert redact_pii("PAN ABCPE1234F here") == f"PAN {PAN_PLACEHOLDER} here"
    assert redact_pii("pan abcpe1234f") == f"pan {PAN_PLACEHOLDER}"


def test_ordinary_text_is_unchanged():
    text = "Call 9000000000, pay Rs 5000 to safe@upi, ref 12345"
    assert redact_pii(text) == text
