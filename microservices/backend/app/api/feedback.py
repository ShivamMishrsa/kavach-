"""The "Result looks wrong?" button. Only the choice and a short note are kept, never a file."""

import json
import threading

from fastapi import APIRouter, Response

from app.models import FeedbackRequest
from app.services import ServicesDep

router = APIRouter(prefix="/v1/feedback", tags=["feedback"])

_WRITE_LOCK = threading.Lock()


@router.post("", status_code=204)
def send_feedback(body: FeedbackRequest, services: ServicesDep) -> Response:
    entry = body.model_dump(by_alias=True, exclude_none=True)
    line = json.dumps({"at": services.clock().isoformat(), **entry}, ensure_ascii=False)
    path = services.settings.feedback_path
    with _WRITE_LOCK:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as log:
            log.write(line + "\n")
    return Response(status_code=204)
