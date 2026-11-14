from datetime import UTC, datetime

import pytest

from app.scans.ingest import MAX_NAME_LENGTH, detect_file_kind, fingerprint, safe_name


@pytest.mark.parametrize(
    ("data", "kind"),
    [
        (b"\xff\xd8\xff\xe0rest", "image"),
        (b"\x89PNG\r\n\x1a\nrest", "image"),
        (b"%PDF-1.7 rest", "pdf"),
        (b"GIF89a", None),
        (b"MZ", None),
        (b"", None),
    ],
)
def test_file_kind_comes_from_the_first_bytes(data, kind):
    assert detect_file_kind(data) == kind


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ("notice.png", "notice.png"),
        ("..\\..\\windows\\notice.png", "notice.png"),
        ("/etc/passwd", "passwd"),
        ("a\x00b\x1f.png", "ab.png"),
        ("  spaced name.pdf  ", "spaced name.pdf"),
        ("", "upload"),
        (None, "upload"),
        ("/", "upload"),
    ],
)
def test_safe_name(given, expected):
    assert safe_name(given) == expected


def test_safe_name_is_not_too_long():
    assert len(safe_name("a" * 500 + ".png")) == MAX_NAME_LENGTH


def test_fingerprint_is_the_sha256_of_the_exact_bytes():
    now = datetime(2026, 11, 13, tzinfo=UTC)
    proof = fingerprint("a.txt", b"abc", now)
    assert proof.sha256 == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    assert proof.captured_at == now and proof.name == "a.txt"
