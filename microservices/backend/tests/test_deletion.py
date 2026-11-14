"""The promises about deletion and privacy, checked against what really exists afterwards."""

import logging
import tempfile
import time
from dataclasses import replace

from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import FakeOcr, InlineExecutor
from tests.test_dossier import ENGLISH

SECRET_UTR = "400000000001"
SECRET_UPI = "safe.verification@upi"
SECRET_NAME = "ramesh-kumar-notice.png"
NOTICE = f"Digital arrest! Pay Rs 50,000 to {SECRET_UPI} now. UTR {SECRET_UTR}. Call 9000000000."
PNG = b"\x89PNG\r\n\x1a\n" + b"x" * 2_000_000  # above the size where uploads are spooled to disk


def run_whole_flow(client) -> str:
    """Photo -> result -> confirmed details -> PDF -> download. Returns the scan id."""
    scan = client.post(
        "/v1/scans", data={"kind": "notice"}, files={"file": (SECRET_NAME, PNG, "image/png")}
    ).json()
    entities = [{"type": "utr", "value": SECRET_UTR}, {"type": "upi", "value": SECRET_UPI}]
    client.put(f"/v1/scans/{scan['id']}/entities", json={"entities": entities})
    made = client.post(f"/v1/scans/{scan['id']}/dossier", json=ENGLISH).json()
    client.get(made["url"])
    client.post("/v1/feedback", json={"scanId": scan["id"], "type": "other"})
    return scan["id"]


def test_the_upload_is_never_written_to_disk(make_client, settings, tmp_path, monkeypatch):
    spool = tmp_path / "spool"
    spool.mkdir()
    monkeypatch.setattr(tempfile, "tempdir", str(spool))  # where uploads would be spooled
    client = make_client(FakeOcr(text=NOTICE))
    run_whole_flow(client)
    assert list(spool.iterdir()) == []  # the temporary copy was removed after the request
    written = sorted(path.name for path in settings.data_dir.rglob("*") if path.is_file())
    assert written == ["feedback.jsonl"]  # nothing else: no file, no result, no PDF
    assert SECRET_NAME not in settings.feedback_path.read_text("utf-8")


def test_nothing_about_the_person_reaches_the_logs(make_client, caplog):
    client = make_client(FakeOcr(text=NOTICE))
    with caplog.at_level(logging.DEBUG):
        run_whole_flow(client)
        make_client(FakeOcr(error=RuntimeError(NOTICE))).post(
            "/v1/scans", data={"kind": "notice"}, files={"file": (SECRET_NAME, PNG, "image/png")}
        )
    for secret in (SECRET_UTR, SECRET_UPI, SECRET_NAME, "9000000000", "Digital arrest"):
        assert secret not in caplog.text, secret


def test_everything_about_a_scan_is_gone_when_it_expires(make_client, clock):
    client = make_client(FakeOcr(text=NOTICE))
    scan_id = run_whole_flow(client)
    store = client.app.state.services.store
    assert scan_id in store._records and store._records[scan_id].dossier
    clock.advance(minutes=15)
    store.purge()
    assert store._records == {}  # the result, the confirmed details and the PDF are all gone


def test_the_background_sweep_deletes_expired_scans_when_nobody_is_asking(settings, clock):
    fast = replace(settings, purge_interval_seconds=0.02)
    app = create_app(fast, ocr=FakeOcr(text=NOTICE), executor=InlineExecutor(), clock=clock)
    with TestClient(app) as client:
        run_whole_flow(client)
        store = app.state.services.store
        assert len(store._records) == 1
        clock.advance(minutes=16)  # no request is made from here on
        deadline = time.monotonic() + 3
        while store._records and time.monotonic() < deadline:
            time.sleep(0.02)
        assert store._records == {}


def test_the_sweep_leaves_scans_that_are_still_valid(settings, clock):
    fast = replace(settings, purge_interval_seconds=0.02)
    app = create_app(fast, ocr=FakeOcr(text=NOTICE), executor=InlineExecutor(), clock=clock)
    with TestClient(app) as client:
        run_whole_flow(client)
        clock.advance(minutes=10)
        time.sleep(0.2)  # several sweeps
        assert len(app.state.services.store._records) == 1


def test_deleting_removes_the_pdf_too(make_client):
    client = make_client(FakeOcr(text=NOTICE))
    scan_id = run_whole_flow(client)
    client.delete(f"/v1/scans/{scan_id}")
    assert client.app.state.services.store._records == {}
