import json

import pytest


def records(settings) -> list[dict]:
    return [json.loads(line) for line in settings.consent_path.read_text("utf-8").splitlines()]


def test_agreeing_is_recorded_with_version_time_and_a_hashed_address(make_client, settings):
    client = make_client(host="203.0.113.7")
    response = client.post(
        "/v1/consent", json={"version": settings.consent_version, "granted": True}
    )
    assert response.status_code == 204
    (record,) = records(settings)
    assert record["version"] == settings.consent_version
    assert record["granted"] is True
    assert record["at"] == "2026-11-13T10:00:00+00:00"
    assert len(record["person"]) == 64
    assert set(record) == {"at", "version", "granted", "person"}


def test_the_address_itself_is_never_written(make_client, settings):
    make_client(host="203.0.113.7").post(
        "/v1/consent", json={"version": settings.consent_version, "granted": True}
    )
    assert "203.0.113.7" not in settings.consent_path.read_text("utf-8")


def test_the_same_person_gets_the_same_hash_and_another_person_a_different_one(
    make_client, settings
):
    body = {"version": settings.consent_version, "granted": True}
    make_client(host="203.0.113.7").post("/v1/consent", json=body)
    make_client(host="203.0.113.7").post("/v1/consent", json={**body, "granted": False})
    make_client(host="203.0.113.8").post("/v1/consent", json=body)
    first, again, other = (record["person"] for record in records(settings))
    assert first == again and first != other


def test_withdrawing_is_recorded_too(make_client, settings):
    client = make_client()
    client.post("/v1/consent", json={"version": settings.consent_version, "granted": True})
    client.post("/v1/consent", json={"version": settings.consent_version, "granted": False})
    assert [record["granted"] for record in records(settings)] == [True, False]


@pytest.mark.parametrize(
    "body",
    [
        {"version": "1999-01-v0", "granted": True},
        {"version": "2026-11-v1"},
        {"granted": True},
        {"version": "x" * 33, "granted": True},
    ],
)
def test_an_unknown_version_or_a_bad_body_is_refused_and_not_recorded(make_client, settings, body):
    assert make_client().post("/v1/consent", json=body).status_code == 400
    assert not settings.consent_path.exists()
