import pytest

from app.detection.links import check_link, normalize_url


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("https://sbi.co.in/login", "https://sbi.co.in/login"),
        ("sbi.co.in", "https://sbi.co.in"),
        ("  www.example.com/a?b=1  ", "https://www.example.com/a?b=1"),
        ("http://example.com", "http://example.com"),
    ],
)
def test_addresses_are_accepted(raw: str, expected: str):
    assert normalize_url(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "   ",
        "hello",
        "two words.com",
        "ftp://example.com",
        "javascript:alert(1)",
        "https://",
        "https://example.com:notaport",
        "a" * 2100 + ".com",
    ],
)
def test_other_things_are_rejected(raw: str):
    assert normalize_url(raw) is None


def reasons(url: str) -> list[str]:
    return check_link(url).reasons


@pytest.mark.parametrize(
    "url",
    [
        "https://sbi.co.in/login",
        "https://www.hdfcbank.com",
        "https://netbanking.icicibank.com",
        "https://incometax.gov.in",
        "https://cybercrime.gov.in/report",
        "https://epfindia.gov.in",
        "https://services.digilocker.nic.in",
    ],
)
def test_official_addresses_are_official_and_clean(url: str):
    check = check_link(url)
    assert check.official
    assert check.reasons == []


@pytest.mark.parametrize(
    "url",
    [
        "https://sbi-kyc-update.example/verify",  # brand + scam words
        "https://sbikyc.example",
        "https://paytm-refund.in",
        "https://hdfcbank-login.com",  # looks like an official name but is another domain
        "https://sbi.co.in.verify-now.xyz",  # official name used as a subdomain
        "https://paytn.com",  # one-letter typo
        "https://phonepee.com",
        "https://sb1-kyc.example",  # digit in place of a letter
        "https://ph0nepe-offer.example",
        "https://sbi.co.in@evil.example/login",  # decoy before the @
    ],
)
def test_lookalike_addresses_are_flagged(url: str):
    check = check_link(url)
    assert not check.official
    assert "lookalike_domain" in check.reasons


def test_homoglyph_with_cyrillic_letters_is_flagged():
    host = "ѕbі-kyc.example"  # reads "sbi-kyc" but uses Cyrillic ѕ and і
    assert "lookalike_domain" in reasons(f"https://{host}")


def test_punycode_form_of_a_homoglyph_is_flagged_too():
    host = "ѕbі-kyc.example".encode("idna").decode()
    assert host.startswith("xn--")
    assert "lookalike_domain" in reasons(f"https://{host}")


def test_mixed_scripts_in_one_label_are_flagged():
    assert "lookalike_domain" in reasons("https://bankक.example")


def test_a_genuine_non_latin_domain_is_not_called_a_lookalike():
    host = "भारत.example".encode("idna").decode()
    assert reasons(f"https://{host}") == []


@pytest.mark.parametrize(
    "url",
    [
        "https://example.com",
        "https://axiscades.com",  # a different company that merely starts with a bank's name
        "https://taxis.example",
        "https://bit.ly/abc",
        "https://mail.google.com",
    ],
)
def test_other_addresses_are_not_flagged_but_not_called_safe_either(url: str):
    check = check_link(url)
    assert not check.official
    assert check.reasons == []


def test_http_is_flagged_as_insecure():
    assert reasons("http://example.com") == ["insecure_link"]
    assert reasons("http://sbi-kyc.example") == ["lookalike_domain", "insecure_link"]
    assert reasons("http://sbi.co.in") == ["insecure_link"]
