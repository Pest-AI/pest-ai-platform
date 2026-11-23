"""Fixtures pytest partagées par tous les tests du backend."""

import pytest
from rest_framework.test import APIClient


@pytest.fixture(autouse=True)
def _vider_le_cache():
    """Cache vidé à chaque test : les compteurs de limitation de fréquence repartent de zéro."""
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


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


# ── Organisations, adhésions, espaces de travail ─────────────────────────────
@pytest.fixture
def roles(db):
    """Les 7 rôles système et leurs permissions (déjà chargés après migrate ; idempotent)."""
    from apps.organizations import services

    services.sync_system_roles()


@pytest.fixture
def make_org(db):
    """Fabrique d'organisations actives : make_org("Coopérative de Podor")."""
    from apps.organizations.models import Organization

    def _make_org(name="Coopérative de Podor", status=None, **fields):
        fields.setdefault("organization_type", Organization.OrganizationType.COOPERATIVE)
        return Organization.objects.create(
            name=name, status=status or Organization.Status.ACTIVE, **fields
        )

    return _make_org


@pytest.fixture
def make_member(roles, make_user):
    """Crée un utilisateur avec une adhésion ACTIVE et les rôles demandés.

    user, membership = make_member(organisation, "organization_admin")
    """
    from apps.organizations import services

    def _make_member(organization, *role_codes, user=None):
        user = user or make_user()
        membership = services.invite_member(
            organization=organization, user=user, invited_by=None, role_codes=role_codes
        )
        services.accept_invitation(membership=membership, user=user)
        membership.refresh_from_db()
        return user, membership

    return _make_member


@pytest.fixture
def api():
    """Client API ; api.as_user(user, workspace=org) authentifie et fixe X-Workspace."""
    client = APIClient()

    def as_user(user, workspace=None):
        client.force_authenticate(user=user)
        if workspace is None:
            client.credentials()
        elif isinstance(workspace, str):
            client.credentials(HTTP_X_WORKSPACE=workspace)
        else:
            client.credentials(HTTP_X_WORKSPACE=f"org:{workspace.pk}")
        return client

    client.as_user = as_user
    return client


@pytest.fixture
def two_orgs(make_org):
    return make_org("Coopérative A"), make_org("Coopérative B")
