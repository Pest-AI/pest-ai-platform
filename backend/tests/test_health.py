"""Tests du point de santé de l'API."""

from django.urls import reverse


def test_health_repond_ok(client):
    response = client.get(reverse("health"))

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "pest-ai-os-api"
    assert body["environment"] == "local"


def test_health_refuse_post(client):
    response = client.post(reverse("health"))

    assert response.status_code == 405
