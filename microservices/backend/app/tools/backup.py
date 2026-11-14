"""Copies the account database and the consent and feedback logs somewhere safe, removes old copies.

    python -m app.tools.backup --to /backups                       # make a copy, remove old ones
    python -m app.tools.backup --restore /backups/kavach-backup-... --into /data

Each run makes one folder named after the time. The database is copied with SQLite's own online
backup, so the copy is consistent while the service keeps running; the logs are plain files. The
copy is checked (SQLite's integrity check) before any old copy is removed.

A copy holds the same personal data as the live files (email addresses), so keep it somewhere just
as protected. Copies older than `--keep-days` (30 by default) are deleted, which is how a deleted
account leaves the backups too: the privacy policy promises this within 30 days.
"""

import argparse
import shutil
import sqlite3
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

from app.core.config import Settings
from app.core.config import settings as default_settings

PREFIX = "kavach-backup-"
STAMP = "%Y%m%dT%H%M%SZ"


def make_backup(settings: Settings, target: Path, now: datetime) -> Path:
    """Writes a new, checked copy under `target` and returns its folder."""
    folder = target / f"{PREFIX}{now.strftime(STAMP)}"
    folder.mkdir(parents=True)
    try:
        if settings.database_path.exists():
            _copy_database(settings.database_path, folder / settings.database_path.name)
        for log in (settings.consent_path, settings.feedback_path):
            if log.exists():
                shutil.copy2(log, folder / log.name)
    except Exception:
        shutil.rmtree(folder, ignore_errors=True)  # never leave a half copy that looks complete
        raise
    return folder


def _copy_database(source: Path, destination: Path) -> None:
    live, copy = sqlite3.connect(source), sqlite3.connect(destination)
    try:
        live.backup(copy)
        verdict = copy.execute("PRAGMA integrity_check").fetchone()[0]
    finally:
        live.close()
        copy.close()
    if verdict != "ok":
        raise RuntimeError("the copy of the database is damaged")


def prune(target: Path, keep_days: int, now: datetime) -> list[Path]:
    """Deletes the copies made more than `keep_days` ago. Returns what was deleted."""
    cutoff = now - timedelta(days=keep_days)
    removed = []
    for folder in sorted(target.glob(f"{PREFIX}*")):
        try:
            made = datetime.strptime(folder.name.removeprefix(PREFIX), STAMP).replace(tzinfo=UTC)
        except ValueError:
            continue  # not one of ours
        if made < cutoff:
            shutil.rmtree(folder)
            removed.append(folder)
    return removed


def restore(backup: Path, data_dir: Path, *, force: bool = False) -> None:
    """Puts a copy back. Stop the service first: this replaces its files."""
    database = backup / Settings(data_dir=data_dir).database_path.name
    if not database.exists():
        raise FileNotFoundError(f"no database in {backup}")
    data_dir.mkdir(parents=True, exist_ok=True)
    existing = [path for path in data_dir.iterdir() if path.is_file()]
    if existing and not force:
        raise FileExistsError(f"{data_dir} already has data; use --force to replace it")
    for item in backup.iterdir():
        shutil.copy2(item, data_dir / item.name)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--to", type=Path, help="folder that holds the copies")
    parser.add_argument("--keep-days", type=int, default=30)
    parser.add_argument("--restore", type=Path, help="a copy to put back")
    parser.add_argument("--into", type=Path, help="data folder to restore into")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args(argv)

    if args.restore:
        restore(args.restore, args.into or default_settings.data_dir, force=args.force)
        print(f"restored {args.restore}")
        return 0
    if not args.to:
        parser.error("give --to <folder> (or --restore)")
    now = datetime.now(UTC)
    folder = make_backup(default_settings, args.to, now)
    removed = prune(args.to, args.keep_days, now)
    print(f"copied to {folder}; removed {len(removed)} old copies")
    return 0


if __name__ == "__main__":
    sys.exit(main())
