"""Records that someone agreed to (or withdrew) a version of the consent text.

The record holds the version, the time and a keyed hash of the IP address, never the address.
"""

from fastapi import APIRouter, Request, Response

from app.core.errors import invalid_input
from app.core.jsonl import append_record
from app.models import ConsentRequest
from app.services import ServicesDep, limited, person_key

router = APIRouter(prefix="/v1/consent", tags=["consent"])


@router.post("", status_code=204, dependencies=[limited("consent")])
def record_consent(body: ConsentRequest, request: Request, services: ServicesDep) -> Response:
    if body.version != services.settings.consent_version:
        raise invalid_input()
    append_record(
        services.settings.consent_path,
        {
            "at": services.clock().isoformat(),
            "version": body.version,
            "granted": body.granted,
            "person": person_key(request, services),
        },
    )
    return Response(status_code=204)
