"""The "Result looks wrong?" button. Only the choice and a short note are kept, never a file."""

from fastapi import APIRouter, Response

from app.core.jsonl import append_record
from app.detection.entities import extract_entities
from app.detection.pii import redact_pii
from app.models import FeedbackRequest
from app.services import ServicesDep, limited

router = APIRouter(prefix="/v1/feedback", tags=["feedback"])

REMOVED = "[removed]"


def scrub(note: str) -> str:
    """The note is free text, so personal details are taken out before it is written: Aadhaar, PAN,
    email addresses, phone numbers, UPI ids and payment references."""
    clean = redact_pii(note)
    for entity in extract_entities(clean):
        if entity.type in ("phone", "upi", "utr"):
            clean = clean.replace(entity.value, REMOVED)
    return clean


@router.post("", status_code=204, dependencies=[limited("feedback")])
def send_feedback(body: FeedbackRequest, services: ServicesDep) -> Response:
    if body.note:
        body = body.model_copy(update={"note": scrub(body.note)})
    entry = body.model_dump(by_alias=True, exclude_none=True)
    append_record(services.settings.feedback_path, {"at": services.clock().isoformat(), **entry})
    return Response(status_code=204)
