"""Accounts, sign-in links, sessions and the optional synced history, in one small SQLite file.

A sign-in link and a session are random secrets. Only their SHA-256 is stored, so a copy of the
database cannot be used to sign in. The history holds only the kind, the risk level and the time
of a check (the same as the device list), never a file, a text or a detail.
"""

import hashlib
import secrets
import sqlite3
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from app.models import HistoryItem

MAX_HISTORY = 500

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  language TEXT,
  sync_history INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS email_changes (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_email TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS history (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  kind TEXT NOT NULL,
  risk_level TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
"""


@dataclass(frozen=True)
class User:
    id: str
    email: str
    language: str | None
    sync_history: bool
    created_at: datetime


def _hash(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


class AccountStore:
    def __init__(
        self,
        path: Path,
        clock: Callable[[], datetime],
        *,
        link_ttl: timedelta,
        session_ttl: timedelta,
        inactive_ttl: timedelta,
    ) -> None:
        self._path = path
        self._clock = clock
        self._link_ttl = link_ttl
        self._session_ttl = session_ttl
        self._inactive_ttl = inactive_ttl
        path.parent.mkdir(parents=True, exist_ok=True)
        with self._db() as db:
            db.executescript(_SCHEMA)
            columns = [row["name"] for row in db.execute("PRAGMA table_info(users)")]
            if "last_login_at" not in columns:  # a database made before this column existed
                db.execute("ALTER TABLE users ADD COLUMN last_login_at INTEGER NOT NULL DEFAULT 0")
                db.execute("UPDATE users SET last_login_at = ?", (self._now(),))

    @contextmanager
    def _db(self) -> Iterator[sqlite3.Connection]:
        db = sqlite3.connect(self._path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
        try:
            with db:  # commits when the block ends well, rolls back on an error
                yield db
        finally:
            db.close()

    def _now(self) -> int:
        return int(self._clock().timestamp())

    @staticmethod
    def _user(row: sqlite3.Row) -> User:
        return User(
            id=row["id"],
            email=row["email"],
            language=row["language"],
            sync_history=bool(row["sync_history"]),
            created_at=datetime.fromtimestamp(row["created_at"], UTC),
        )

    # ----- sign-in links and sessions -----

    def new_login_token(self, email: str) -> str:
        token = secrets.token_urlsafe(32)
        expires = self._now() + int(self._link_ttl.total_seconds())
        with self._db() as db:
            db.execute("INSERT INTO login_tokens VALUES (?, ?, ?)", (_hash(token), email, expires))
        return token

    def redeem(self, token: str) -> User | None:
        """Uses a sign-in link once. The same answer (None) for unknown, used and expired links."""
        now = self._now()
        with self._db() as db:
            row = db.execute(
                "DELETE FROM login_tokens WHERE token_hash = ? RETURNING email, expires_at",
                (_hash(token),),
            ).fetchone()
            if row is None or row["expires_at"] <= now:
                return None
            found = db.execute("SELECT * FROM users WHERE email = ?", (row["email"],)).fetchone()
            if found is None:
                user_id = "usr_" + secrets.token_urlsafe(12)
                db.execute(
                    "INSERT INTO users (id, email, created_at, last_login_at) VALUES (?, ?, ?, ?)",
                    (user_id, row["email"], now, now),
                )
            else:
                user_id = found["id"]
                db.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (now, user_id))
            return self._user(db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone())

    def open_session(self, user_id: str) -> str:
        token = secrets.token_urlsafe(32)
        now = self._now()
        expires = now + int(self._session_ttl.total_seconds())
        with self._db() as db:
            db.execute(
                "INSERT INTO sessions VALUES (?, ?, ?, ?)", (_hash(token), user_id, now, expires)
            )
        return token

    def user_for(self, session_token: str) -> User | None:
        with self._db() as db:
            row = db.execute(
                "SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id"
                " WHERE sessions.token_hash = ? AND sessions.expires_at > ?",
                (_hash(session_token), self._now()),
            ).fetchone()
        return self._user(row) if row else None

    def close_session(self, session_token: str) -> None:
        with self._db() as db:
            db.execute("DELETE FROM sessions WHERE token_hash = ?", (_hash(session_token),))

    def close_all_sessions(self, user_id: str) -> None:
        with self._db() as db:
            db.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))

    def sessions(self, user_id: str, current_token: str | None) -> list[dict[str, object]]:
        """The sign-ins that are still valid. The id shown is part of a hash, never the secret."""
        with self._db() as db:
            rows = db.execute(
                "SELECT token_hash, created_at, expires_at FROM sessions"
                " WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC",
                (user_id, self._now()),
            ).fetchall()
        current = _hash(current_token) if current_token else None
        return [
            {
                "id": row["token_hash"][:16],
                "created_at": datetime.fromtimestamp(row["created_at"], UTC),
                "expires_at": datetime.fromtimestamp(row["expires_at"], UTC),
                "current": row["token_hash"] == current,
            }
            for row in rows
        ]

    def close_session_by_id(self, user_id: str, session_id: str) -> None:
        with self._db() as db:
            db.execute(
                "DELETE FROM sessions WHERE user_id = ? AND substr(token_hash, 1, 16) = ?",
                (user_id, session_id),
            )

    # ----- the account -----

    def update(
        self, user_id: str, *, language: str | None = None, sync_history: bool | None = None
    ) -> User:
        with self._db() as db:
            if language is not None:
                db.execute("UPDATE users SET language = ? WHERE id = ?", (language, user_id))
            if sync_history is not None:
                db.execute(
                    "UPDATE users SET sync_history = ? WHERE id = ?", (int(sync_history), user_id)
                )
                if not sync_history:  # turning sync off removes what the server held
                    db.execute("DELETE FROM history WHERE user_id = ?", (user_id,))
            return self._user(db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone())

    def new_email_change(self, user: User, new_email: str) -> str | None:
        """A link to confirm a new address. None when the address is already someone's."""
        with self._db() as db:
            taken = db.execute("SELECT id FROM users WHERE email = ?", (new_email,)).fetchone()
            if taken is not None:
                return None
            token = secrets.token_urlsafe(32)
            expires = self._now() + int(self._link_ttl.total_seconds())
            db.execute(
                "INSERT INTO email_changes VALUES (?, ?, ?, ?)",
                (_hash(token), user.id, new_email, expires),
            )
        return token

    def confirm_email_change(self, user: User, token: str) -> User | None:
        """Uses the link once. The same answer (None) for a wrong, used, expired or foreign link."""
        with self._db() as db:
            row = db.execute(
                "DELETE FROM email_changes WHERE token_hash = ?"
                " RETURNING user_id, new_email, expires_at",
                (_hash(token),),
            ).fetchone()
            if row is None or row["user_id"] != user.id or row["expires_at"] <= self._now():
                return None
            taken = db.execute(
                "SELECT id FROM users WHERE email = ? AND id != ?", (row["new_email"], user.id)
            ).fetchone()
            if taken is not None:
                return None
            db.execute("UPDATE users SET email = ? WHERE id = ?", (row["new_email"], user.id))
            return self._user(db.execute("SELECT * FROM users WHERE id = ?", (user.id,)).fetchone())

    def delete_user(self, user: User) -> None:
        with self._db() as db:
            db.execute("DELETE FROM login_tokens WHERE email = ?", (user.email,))
            db.execute("DELETE FROM users WHERE id = ?", (user.id,))  # sessions, history cascade

    def export(self, user: User) -> dict[str, object]:
        with self._db() as db:
            sessions = db.execute(
                "SELECT COUNT(*) FROM sessions WHERE user_id = ? AND expires_at > ?",
                (user.id, self._now()),
            ).fetchone()[0]
        return {
            "account": {
                "id": user.id,
                "email": user.email,
                "language": user.language,
                "syncHistory": user.sync_history,
                "createdAt": user.created_at.isoformat(),
            },
            "activeSessions": sessions,
            "history": [
                item.model_dump(by_alias=True, mode="json") for item in self.history(user.id)
            ],
        }

    # ----- synced history -----

    def history(self, user_id: str) -> list[HistoryItem]:
        with self._db() as db:
            rows = db.execute(
                "SELECT id, kind, risk_level, created_at FROM history WHERE user_id = ?"
                " ORDER BY created_at DESC",
                (user_id,),
            ).fetchall()
        return [
            HistoryItem(
                id=row["id"],
                kind=row["kind"],
                risk_level=row["risk_level"],
                created_at=datetime.fromisoformat(row["created_at"]),
            )
            for row in rows
        ]

    def upsert_history(self, user_id: str, items: list[HistoryItem]) -> None:
        with self._db() as db:
            db.executemany(
                "INSERT OR REPLACE INTO history VALUES (?, ?, ?, ?, ?)",
                [
                    (user_id, item.id, item.kind, item.risk_level, item.created_at.isoformat())
                    for item in items
                ],
            )
            db.execute(
                "DELETE FROM history WHERE user_id = ? AND id NOT IN ("
                "SELECT id FROM history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?)",
                (user_id, user_id, MAX_HISTORY),
            )

    def delete_history(self, user_id: str, item_id: str | None = None) -> None:
        with self._db() as db:
            if item_id is None:
                db.execute("DELETE FROM history WHERE user_id = ?", (user_id,))
            else:
                db.execute("DELETE FROM history WHERE user_id = ? AND id = ?", (user_id, item_id))

    def purge(self) -> None:
        """Removes links and sessions that have run out, and accounts nobody has signed in to for
        the inactive period (their sessions, history and pending changes go with them)."""
        now = self._now()
        with self._db() as db:
            db.execute("DELETE FROM login_tokens WHERE expires_at <= ?", (now,))
            db.execute("DELETE FROM email_changes WHERE expires_at <= ?", (now,))
            db.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
            cutoff = now - int(self._inactive_ttl.total_seconds())
            db.execute("DELETE FROM users WHERE last_login_at < ?", (cutoff,))
