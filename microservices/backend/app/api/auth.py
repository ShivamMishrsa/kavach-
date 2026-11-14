"""Signing in with an emailed link: no passwords. One screen both creates and opens an account."""

from fastapi import APIRouter, BackgroundTasks, Request, Response

from app.accounts.deps import SESSION_COOKIE, CurrentUser, SameOrigin
from app.accounts.mail import message
from app.accounts.store import User
from app.core.errors import unauthorized
from app.core.signing import keyed_hash
from app.models import Account, MagicLinkRequest, ProfileUpdate, SignIn, VerifyRequest
from app.services import ServicesDep, limited

router = APIRouter(prefix="/v1/auth", tags=["auth"])


def signed_out() -> Response:
    """An empty answer that also removes the session cookie from the browser."""
    response = Response(status_code=204)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response


def to_account(user: User) -> Account:
    return Account(
        id=user.id, email=user.email, language=user.language, sync_history=user.sync_history
    )


@router.post("/magic-link", status_code=202, dependencies=[limited("magic_link")])
def send_link(body: MagicLinkRequest, background: BackgroundTasks, services: ServicesDep) -> dict:
    """Always answers the same, so nobody can find out which addresses have an account."""
    settings = services.settings
    if services.email_limiter.allow("magic_link", keyed_hash(settings.secret, body.email)):
        token = services.accounts.new_login_token(body.email)
        link = f"{settings.site_url}/auth/verify#token={token}"
        subject, text = message("sign_in", body.language, link, settings.login_link_minutes)
        background.add_task(services.mailer.send, body.email, subject, text)
    return {}


@router.post("/verify", response_model=Account, dependencies=[limited("verify"), SameOrigin])
def verify(body: VerifyRequest, response: Response, services: ServicesDep) -> Account:
    user = services.accounts.redeem(body.token)
    if user is None:
        raise unauthorized()
    settings = services.settings
    response.set_cookie(
        SESSION_COOKIE,
        services.accounts.open_session(user.id),
        max_age=settings.session_days * 24 * 3600,
        httponly=True,
        secure=settings.env != "dev",
        samesite="lax",
        path="/",
    )
    return to_account(user)


@router.get("/me", response_model=Account)
def me(user: CurrentUser) -> Account:
    return to_account(user)


@router.put("/profile", response_model=Account, dependencies=[SameOrigin])
def update_profile(body: ProfileUpdate, user: CurrentUser, services: ServicesDep) -> Account:
    return to_account(
        services.accounts.update(user.id, language=body.language, sync_history=body.sync_history)
    )


@router.get("/sessions", response_model=list[SignIn])
def list_sign_ins(request: Request, user: CurrentUser, services: ServicesDep) -> list[SignIn]:
    sessions = services.accounts.sessions(user.id, request.cookies.get(SESSION_COOKIE))
    return [SignIn(**session) for session in sessions]


@router.delete("/sessions/{session_id}", status_code=204, dependencies=[SameOrigin])
def end_sign_in(
    session_id: str, request: Request, user: CurrentUser, services: ServicesDep
) -> Response:
    ours = {
        s["id"]
        for s in services.accounts.sessions(user.id, request.cookies.get(SESSION_COOKIE))
        if s["current"]
    }
    services.accounts.close_session_by_id(user.id, session_id)
    return signed_out() if session_id in ours else Response(status_code=204)


@router.post("/logout", status_code=204, dependencies=[SameOrigin])
def logout(request: Request, services: ServicesDep) -> Response:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        services.accounts.close_session(token)
    return signed_out()


@router.post("/logout-all", status_code=204, dependencies=[SameOrigin])
def logout_everywhere(user: CurrentUser, services: ServicesDep) -> Response:
    services.accounts.close_all_sessions(user.id)
    return signed_out()
