"""Who is asking: the account behind the session cookie, and the checks that go with it."""

from typing import Annotated

from fastapi import Depends, Request

from app.accounts.store import User
from app.core.errors import forbidden, not_found, unauthorized
from app.services import Services, ServicesDep

SESSION_COOKIE = "kavach_session"


def optional_user(request: Request, services: ServicesDep) -> User | None:
    token = request.cookies.get(SESSION_COOKIE)
    return services.accounts.user_for(token) if token else None


OptionalUser = Annotated[User | None, Depends(optional_user)]


def require_user(user: OptionalUser) -> User:
    if user is None:
        raise unauthorized()
    return user


CurrentUser = Annotated[User, Depends(require_user)]


def check_owner(scan_id: str, user: User | None, services: Services) -> None:
    """A scan made while signed in can only be reached by that account. A scan made without an
    account is reached by its long random address alone, as before."""
    owner = services.store.owner_of(scan_id)
    if owner is not None and (user is None or user.id != owner):
        raise not_found()  # the same answer as for a scan that does not exist


def trusted_origin(request: Request, services: ServicesDep) -> None:
    """A browser always names the site a request comes from. Refuse requests that change an
    account when that site is not ours (on top of the cookie's SameSite setting)."""
    origin = request.headers.get("origin")
    if origin is not None and origin not in services.settings.cors_origins:
        raise forbidden()


SameOrigin = Depends(trusted_origin)
