"""The account's own data: export, deletion and the optional synced history."""

import json
from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Response

from app.accounts.deps import CurrentUser, SameOrigin
from app.accounts.mail import message
from app.api.auth import signed_out, to_account
from app.core.errors import forbidden, invalid_input, unauthorized
from app.core.signing import keyed_hash
from app.models import Account, EmailChangeRequest, HistoryItem, HistoryUpload, VerifyRequest
from app.services import ServicesDep, limited

router = APIRouter(prefix="/v1", tags=["account"])


@router.get("/account/export")
def export_account(user: CurrentUser, services: ServicesDep) -> Response:
    """Everything the server holds about the account, as a file to save."""
    data = json.dumps(services.accounts.export(user), ensure_ascii=False, indent=2)
    stamp = datetime.now(UTC).strftime("%Y%m%d")
    return Response(
        data,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="kavach-account-{stamp}.json"'},
    )


@router.post("/account/email", status_code=202, dependencies=[SameOrigin, limited("email_change")])
def ask_to_change_email(
    body: EmailChangeRequest, user: CurrentUser, background: BackgroundTasks, services: ServicesDep
) -> dict:
    """Sends a link to the NEW address; the address changes only when it is opened. Answers the
    same when the address is already someone's, so it cannot be used to look people up."""
    settings = services.settings
    if services.email_limiter.allow("email_change", keyed_hash(settings.secret, body.email)):
        token = services.accounts.new_email_change(user, body.email)
        if token is not None:
            link = f"{settings.site_url}/auth/confirm-email#token={token}"
            subject, text = message(
                "change_email", body.language, link, settings.login_link_minutes
            )
            background.add_task(services.mailer.send, body.email, subject, text)
    return {}


@router.post(
    "/account/email/confirm",
    response_model=Account,
    dependencies=[SameOrigin, limited("verify")],
)
def confirm_email_change(body: VerifyRequest, user: CurrentUser, services: ServicesDep) -> Account:
    changed = services.accounts.confirm_email_change(user, body.token)
    if changed is None:
        raise unauthorized()
    return to_account(changed)


@router.delete("/account", status_code=204, dependencies=[SameOrigin])
def delete_account(user: CurrentUser, services: ServicesDep) -> Response:
    """Removes the account, its sessions and history, and any check still running for it."""
    services.store.delete_owned(user.id)
    services.accounts.delete_user(user)
    return signed_out()


@router.get("/history", response_model=list[HistoryItem])
def list_history(user: CurrentUser, services: ServicesDep) -> list[HistoryItem]:
    return services.accounts.history(user.id)


@router.put("/history", status_code=204, dependencies=[SameOrigin])
def save_history(body: HistoryUpload, user: CurrentUser, services: ServicesDep) -> Response:
    """Adds or updates items. Only works while the person has turned history sync on."""
    if not user.sync_history:
        raise forbidden()
    if not body.items:
        raise invalid_input()
    services.accounts.upsert_history(user.id, body.items)
    return Response(status_code=204)


@router.delete("/history/{item_id}", status_code=204, dependencies=[SameOrigin])
def delete_history_item(item_id: str, user: CurrentUser, services: ServicesDep) -> Response:
    services.accounts.delete_history(user.id, item_id)
    return Response(status_code=204)


@router.delete("/history", status_code=204, dependencies=[SameOrigin])
def clear_history(user: CurrentUser, services: ServicesDep) -> Response:
    services.accounts.delete_history(user.id)
    return Response(status_code=204)
