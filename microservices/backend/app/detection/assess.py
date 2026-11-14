"""Puts the detection steps together: text or a link in, a risk result out."""

import unicodedata

from app.detection.entities import extract_entities
from app.detection.links import check_link, normalize_url
from app.detection.pii import redact_pii
from app.detection.risk import ordered, risk_level
from app.detection.signals import detect_signals
from app.detection.statutes import find_statutes, mentions_old_law
from app.models import Entity, ScanResult

# Fewer letters and digits than this is too little to say anything about.
MIN_READABLE_CHARS = 20


def assess_text(text: str, *, confident: bool = True) -> ScanResult:
    """`confident` is False when the text came from a photo that was hard to read."""
    clean = redact_pii(unicodedata.normalize("NFC", text))
    entities = extract_entities(clean)

    reasons = detect_signals(clean)
    if mentions_old_law(clean):
        reasons.add("outdated_section")
    for entity in entities:
        url = normalize_url(entity.value) if entity.type == "link" else None
        if url:
            reasons.update(check_link(url).reasons)

    enough = confident and sum(char.isalnum() for char in clean) >= MIN_READABLE_CHARS
    return ScanResult(
        risk_level=risk_level(reasons, enough_to_judge=enough),
        reason_codes=ordered(reasons),
        entities=entities,
        statutes=find_statutes(clean),
    )


def assess_link(url: str) -> ScanResult:
    """`url` must already be normalised by `normalize_url`."""
    check = check_link(url)
    return ScanResult(
        risk_level=risk_level(check.reasons, enough_to_judge=check.official),
        reason_codes=ordered(check.reasons),
        entities=[Entity(type="link", value=url)],
        statutes=[],
    )
