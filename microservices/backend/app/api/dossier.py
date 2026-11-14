"""The evidence summary (PDF): made from what the person confirmed, fetched by a short link."""

import hashlib
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Response

from app.core.errors import invalid_input, not_found
from app.core.signing import link_is_valid, sign_link
from app.dossier.render import render_dossier
from app.models import DossierFile, DossierText
from app.services import ServicesDep, limited

router = APIRouter(prefix="/v1/scans/{scan_id}", tags=["dossier"])


@router.post(
    "/dossier", response_model=DossierFile, status_code=201, dependencies=[limited("dossier")]
)
def create_dossier(scan_id: str, text: DossierText, services: ServicesDep) -> DossierFile:
    scan = services.store.get(scan_id)
    if scan is None:
        raise not_found()
    # Only facts the person has checked go into the summary.
    if scan.status != "done" or scan.confirmed_entities is None:
        raise invalid_input()

    now = services.clock()
    pdf = render_dossier(text, scan.confirmed_entities, scan.evidence, now)
    if not services.store.attach_dossier(scan_id, pdf):
        raise not_found()

    settings = services.settings
    expires = int(
        min(now + timedelta(seconds=settings.download_link_seconds), scan.expires_at).timestamp()
    )
    signature = sign_link(settings.secret, scan_id, expires)
    return DossierFile(
        url=f"/v1/scans/{scan_id}/dossier.pdf?exp={expires}&sig={signature}",
        sha256=hashlib.sha256(pdf).hexdigest(),
        generated_at=now,
        link_expires_at=datetime.fromtimestamp(expires, UTC),
    )


@router.get("/dossier.pdf")
def download_dossier(scan_id: str, exp: int, sig: str, services: ServicesDep) -> Response:
    pdf = services.store.dossier(scan_id)
    valid = link_is_valid(services.settings.secret, scan_id, exp, sig, services.clock().timestamp())
    if pdf is None or not valid:
        raise not_found()
    return Response(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="kavach-evidence-summary.pdf"'},
    )
