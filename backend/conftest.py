"""Fixtures pytest partagées par tous les tests du backend."""

import pytest
from rest_framework.test import APIClient

TEST_PASSWORD = "Mot-de-passe-test-2026"  # noqa: S105 (valeur factice de test)


@pytest.fixture
def make_user(db):
    """Fabrique d'utilisateurs : make_user(), make_user(phone_number="+221770000002")…"""
    from django.contrib.auth import get_user_model

    counter = {"n": 0}

    def _make_user(**fields):
        counter["n"] += 1
        fields.setdefault("phone_number", f"+22177000{counter['n']:04d}")
        fields.setdefault("first_name", "Awa")
        fields.setdefault("last_name", f"Diallo{counter['n']}")
        password = fields.pop("password", TEST_PASSWORD)
        return get_user_model().objects.create_user(password=password, **fields)

    return _make_user


@pytest.fixture
def user(make_user):
    return make_user()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(user):
    """Client API authentifié (jeton JWT) au nom de la fixture `user`."""
    from rest_framework_simplejwt.tokens import RefreshToken

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    client.user = user
    return client
