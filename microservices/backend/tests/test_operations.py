"""What the person running the service needs: the daily cap, the counters, health."""

from dataclasses import replace

from fastapi.testclient import TestClient

from app.core.metrics import Metrics
from app.core.ratelimit import DailyCap
from tests.conftest import FakeOcr
from tests.test_deletion import NOTICE

TOKEN = "t" * 40
FORM = {"kind": "notice", "text": NOTICE}


# ----- the daily cap -----


def test_the_cap_counts_everybody_together_and_starts_again_each_day(clock):
    cap = DailyCap(3, clock)
    assert [cap.take() for _ in range(5)] == [True, True, True, False, False]
    clock.advance(days=1)
    assert cap.take() is True


def test_a_cap_of_zero_means_no_cap(clock):
    cap = DailyCap(0, clock)
    assert all(cap.take() for _ in range(1000))


def test_past_the_cap_new_checks_get_busy_and_old_ones_still_work(make_client, settings):
    client = make_client(FakeOcr(text=NOTICE), config=replace(settings, max_scans_per_day=2))
    first = client.post("/v1/scans", data=FORM)
    assert first.status_code == 201
    assert client.post("/v1/scans", data=FORM).status_code == 201
    over = TestClient(client.app, client=("another-person", 50000)).post("/v1/scans", data=FORM)
    assert over.status_code == 503 and over.json() == {"error": {"code": "busy"}}
    assert client.get(f"/v1/scans/{first.json()['id']}").status_code == 200


def test_the_cap_opens_again_the_next_day(make_client, settings, clock):
    client = make_client(FakeOcr(text=NOTICE), config=replace(settings, max_scans_per_day=1))
    assert client.post("/v1/scans", data=FORM).status_code == 201
    assert client.post("/v1/scans", data=FORM).status_code == 503
    clock.advance(days=1)
    assert client.post("/v1/scans", data=FORM).status_code == 201


def test_reading_and_signing_in_are_not_blocked_by_the_cap(make_client, settings):
    client = make_client(config=replace(settings, max_scans_per_day=1))
    client.post("/v1/scans", data=FORM)
    client.post("/v1/scans", data=FORM)  # busy
    assert client.get("/health").status_code == 200
    assert client.post("/v1/auth/magic-link", json={"email": "a@example.com"}).status_code == 202


# ----- the counters -----


def test_counters_are_written_in_the_prometheus_format():
    metrics = Metrics()
    metrics.count("scans", kind="notice", status="done")
    metrics.count("scans", kind="notice", status="done")
    metrics.count("busy")
    metrics.scan_finished(0.3)
    metrics.scan_finished(7.0)
    text = metrics.render()
    assert 'kavach_scans_total{kind="notice",status="done"} 2' in text
    assert "kavach_busy_total 1" in text
    assert 'kavach_scan_seconds_bucket{le="0.5"} 1' in text
    assert 'kavach_scan_seconds_bucket{le="10.0"} 2' in text
    assert 'kavach_scan_seconds_bucket{le="+Inf"} 2' in text
    assert "kavach_scan_seconds_count 2" in text


def test_the_endpoint_does_not_exist_without_a_token(make_client):
    assert make_client().get("/metrics").status_code == 404


def test_the_endpoint_needs_the_token(make_client, settings):
    client = make_client(config=replace(settings, metrics_token=TOKEN))
    assert client.get("/metrics").status_code == 401
    assert client.get("/metrics", headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.get("/metrics", headers={"Authorization": TOKEN}).status_code == 401
    assert client.get("/metrics", headers={"Authorization": f"Bearer {TOKEN}"}).status_code == 200


def test_a_scan_shows_up_in_the_counters_without_anything_about_the_person(make_client, settings):
    client = make_client(FakeOcr(text=NOTICE), config=replace(settings, metrics_token=TOKEN))
    scan = client.post("/v1/scans", data=FORM).json()
    client.get(f"/v1/scans/{scan['id']}")
    client.get("/v1/scans/does-not-exist")
    text = client.get("/metrics", headers={"Authorization": f"Bearer {TOKEN}"}).text
    assert 'kavach_scans_total{kind="notice",status="done"} 1' in text
    assert 'kavach_risk_level_total{level="very_high"} 1' in text
    assert 'kavach_http_responses_total{status="2xx"}' in text
    assert 'kavach_http_responses_total{status="4xx"}' in text
    for secret in (NOTICE[:20], scan["id"], "testclient", "50000"):
        assert secret not in text


def test_rate_limits_sign_ins_and_failures_are_counted(make_client, settings, outbox):
    client = make_client(
        FakeOcr(error=RuntimeError("x")), config=replace(settings, metrics_token=TOKEN)
    )
    for _ in range(21):
        client.post("/v1/feedback", json={"scanId": "s", "type": "other"})
    photo = {"file": ("n.png", b"\x89PNG\r\n\x1a\nabc", "image/png")}
    client.post("/v1/scans", data={"kind": "notice"}, files=photo)  # the OCR is broken
    client.post("/v1/auth/magic-link", json={"email": "a@example.com"})
    client.post("/v1/auth/verify", json={"token": outbox.last_token()})
    text = client.get("/metrics", headers={"Authorization": f"Bearer {TOKEN}"}).text
    assert 'kavach_rate_limited_total{action="feedback"} 1' in text
    assert 'kavach_scans_total{kind="notice",status="failed"} 1' in text
    assert "kavach_signins_total 1" in text
