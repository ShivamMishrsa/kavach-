"""Keyed hashes: signed download links, and IP addresses that are never stored as they are."""

import hashlib
import hmac


def keyed_hash(secret: bytes, value: str) -> str:
    return hmac.new(secret, value.encode(), hashlib.sha256).hexdigest()


def sign_link(secret: bytes, scan_id: str, expires: int) -> str:
    return keyed_hash(secret, f"download.{scan_id}.{expires}")


def link_is_valid(secret: bytes, scan_id: str, expires: int, signature: str, now: float) -> bool:
    expected = sign_link(secret, scan_id, expires)
    return now < expires and hmac.compare_digest(expected, signature)
