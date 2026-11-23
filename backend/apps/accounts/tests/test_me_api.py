"""Tests de /api/v1/me/ et /api/v1/me/password/."""

import pytest
from django.urls import reverse

from conftest import TEST_PASSWORD

pytestmark = pytest.mark.django_db


def test_me_exige_une_authentification(api_client):
    assert api_client.get(reverse("me")).status_code == 401


def test_me_renvoie_le_profil_sans_mot_de_passe(auth_client):
    body = auth_client.get(reverse("me")).json()

    assert body["phone_number"] == auth_client.user.phone_number
    assert body["preferred_language"] == "fr"
    assert "password" not in body


def test_modifier_son_profil(auth_client):
    response = auth_client.patch(
        reverse("me"),
        {"first_name": "Fatou", "email": "fatou@pest.ai", "preferred_language": "wo"},
        format="json",
    )

    assert response.status_code == 200
    user = auth_client.user
    user.refresh_from_db()
    assert user.first_name == "Fatou"
    assert user.email == "fatou@pest.ai"
    assert user.preferred_language == "wo"
    assert user.updated_by == user


def test_numero_de_telephone_non_modifiable_par_me(auth_client):
    original = auth_client.user.phone_number

    auth_client.patch(reverse("me"), {"phone_number": "+221779999999"}, format="json")

    auth_client.user.refresh_from_db()
    assert auth_client.user.phone_number == original


def test_email_deja_utilise_refuse(auth_client, make_user):
    make_user(email="pris@pest.ai")

    response = auth_client.patch(reverse("me"), {"email": "PRIS@pest.ai"}, format="json")

    assert response.status_code == 400
    assert "email" in response.json()


def test_langue_inconnue_refusee(auth_client):
    response = auth_client.patch(reverse("me"), {"preferred_language": "en"}, format="json")

    assert response.status_code == 400


def test_changer_son_mot_de_passe(auth_client):
    response = auth_client.post(
        reverse("me-password"),
        {"current_password": TEST_PASSWORD, "new_password": "Nouveau-mdp-solide-2026"},
        format="json",
    )

    assert response.status_code == 204
    auth_client.user.refresh_from_db()
    assert auth_client.user.check_password("Nouveau-mdp-solide-2026")


def test_mot_de_passe_actuel_incorrect_refuse(auth_client):
    response = auth_client.post(
        reverse("me-password"),
        {"current_password": "faux", "new_password": "Nouveau-mdp-solide-2026"},
        format="json",
    )

    assert response.status_code == 400
    assert "current_password" in response.json()


def test_nouveau_mot_de_passe_trop_faible_refuse(auth_client):
    response = auth_client.post(
        reverse("me-password"),
        {"current_password": TEST_PASSWORD, "new_password": "123"},
        format="json",
    )

    assert response.status_code == 400
    assert "new_password" in response.json()


def test_me_indique_si_l_utilisateur_est_super_admin(auth_client, make_user, roles):
    from apps.organizations import services

    assert auth_client.get(reverse("me")).json()["is_platform_admin"] is False

    services.grant_platform_role(
        user=auth_client.user, granted_by=make_user(), justification="Test Console Admin"
    )
    assert auth_client.get(reverse("me")).json()["is_platform_admin"] is True
