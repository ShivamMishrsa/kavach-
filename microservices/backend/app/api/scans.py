"""Endpoints for checking a notice, message or link. See docs/api-contract.md."""

from typing import Annotated

from fastapi import APIRouter, Depends, Form, Response, UploadFile

from app.accounts.deps import OptionalUser, check_owner
from app.core.errors import invalid_input, not_found
from app.detection.links import normalize_url
from app.models import ConfirmEntitiesRequest, EvidenceHash, Scan, ScanKind
from app.scans.ingest import detect_file_kind, fingerprint, read_limited, safe_name
from app.scans.pipeline import FileSource, LinkSource, Source, TextSource, run_scan
from app.services import Services, ServicesDep, limited, within_daily_cap

router = APIRouter(prefix="/v1/scans", tags=["scans"])


async def _read_input(
    services: Services,
    kind: ScanKind,
    text: str | None,
    url: str | None,
    file: UploadFile | None,
) -> tuple[Source, EvidenceHash]:
    """Checks the input and fingerprints the original.

    Exactly one usable input must be sent, of the kind the scan asks for; otherwise the person
    gets `invalid_input`.
    """
    now = services.clock()
    limits = services.settings
    if [text, url, file].count(None) != 2:
        raise invalid_input()

    if kind == "link" and url is not None:
        link = normalize_url(url)
        if link is not None:
            return LinkSource(link), fingerprint("link.txt", link.encode(), now)
    elif (
        kind == "notice"
        and text is not None
        and text.strip()
        and len(text) <= limits.max_text_chars
    ):
        return TextSource(text), fingerprint("pasted-text.txt", text.encode(), now)
    elif kind == "notice" and file is not None:
        data = await read_limited(file, limits.max_upload_bytes)
        file_kind = detect_file_kind(data) if data else None
        if data and file_kind:
            return FileSource(data, file_kind), fingerprint(safe_name(file.filename), data, now)

    raise invalid_input()


@router.post(
    "",
    response_model=Scan,
    status_code=201,
    dependencies=[limited("scan"), Depends(within_daily_cap)],
)
async def create_scan(
    services: ServicesDep,
    user: OptionalUser,
    kind: Annotated[ScanKind, Form()],
    text: Annotated[str | None, Form()] = None,
    url: Annotated[str | None, Form()] = None,
    file: UploadFile | None = None,
) -> Scan:
    source, evidence = await _read_input(services, kind, text, url, file)
    scan = services.store.create(kind, [evidence], owner=user.id if user else None)
    services.executor.submit(run_scan, services.store, services.ocr, scan.id, source)
    return scan


@router.get("/{scan_id}", response_model=Scan)
def get_scan(scan_id: str, services: ServicesDep, user: OptionalUser) -> Scan:
    check_owner(scan_id, user, services)
    scan = services.store.get(scan_id)
    if scan is None:
        raise not_found()
    return scan


@router.put("/{scan_id}/entities", response_model=Scan)
def confirm_entities(
    scan_id: str, body: ConfirmEntitiesRequest, services: ServicesDep, user: OptionalUser
) -> Scan:
    check_owner(scan_id, user, services)
    scan = services.store.confirm(scan_id, body.entities)
    if scan is None:
        raise not_found()
    return scan


@router.delete("/{scan_id}", status_code=204)
def delete_scan(scan_id: str, services: ServicesDep, user: OptionalUser) -> Response:
    check_owner(scan_id, user, services)
    services.store.delete(scan_id)
    return Response(status_code=204)
