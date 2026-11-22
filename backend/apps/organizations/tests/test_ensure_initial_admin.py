"""Tests de la commande ensure_initial_admin (amorçage d'un environnement déployé)."""

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.accounts.models import User
from apps.organizations import selectors

pytestmark = pytest.mark.django_db
PHONE = "+221770001234"


@pytest.fixture
def admin_env(monkeypatch, roles):
    monkeypatch.setenv("INITIAL_ADMIN_PHONE", "+221 77 000 12 34")
    monkeypatch.setenv("INITIAL_ADMIN_PASSWORD", "Mot-de-passe-staging-2026")
    monkeypatch.setenv("INITIAL_ADMIN_FIRST_NAME", "Thierno")
    monkeypatch.setenv("INITIAL_ADMIN_LAST_NAME", "Dieng")


def test_sans_variables_ne_fait_rien(monkeypatch):
    monkeypatch.delenv("INITIAL_ADMIN_PHONE", raising=False)

    call_command("ensure_initial_admin")

    assert not User.objects.exists()


def test_cree_le_compte_technique_et_le_role_super_admin(admin_env):
    call_command("ensure_initial_admin")

    user = User.objects.get(phone_number=PHONE)
    assert user.is_superuser and user.is_staff
    assert user.first_name == "Thierno"
    assert user.check_password("Mot-de-passe-staging-2026")
    assert selectors.has_active_platform_role(user)


def test_idempotente_et_ne_change_pas_le_mot_de_passe(admin_env, monkeypatch):
    call_command("ensure_initial_admin")
    monkeypatch.setenv("INITIAL_ADMIN_PASSWORD", "Autre-mot-de-passe-2026")

    call_command("ensure_initial_admin")

    assert User.objects.filter(phone_number=PHONE).count() == 1
    assert User.objects.get(phone_number=PHONE).check_password("Mot-de-passe-staging-2026")


def test_role_super_admin_desactivable(admin_env, monkeypatch):
    monkeypatch.setenv("INITIAL_ADMIN_SUPER_ADMIN_DAYS", "0")

    call_command("ensure_initial_admin")

    assert not selectors.has_active_platform_role(User.objects.get(phone_number=PHONE))


def test_mot_de_passe_obligatoire_pour_creer(monkeypatch, roles):
    monkeypatch.setenv("INITIAL_ADMIN_PHONE", PHONE)
    monkeypatch.delenv("INITIAL_ADMIN_PASSWORD", raising=False)

    with pytest.raises(CommandError):
        call_command("ensure_initial_admin")
