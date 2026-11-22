"""Tests de l'authentification JWT : connexion, rafraîchissement, déconnexion."""

import pytest
from django.urls import reverse

from conftest import TEST_PASSWORD

pytestmark = pytest.mark.django_db


def login(client, phone, password=TEST_PASSWORD):
    return client.post(
        reverse("token-obtain"), {"phone_number": phone, "password": password}, format="json"
    )


def test_connexion_renvoie_les_jetons(api_client, user):
    response = login(api_client, user.phone_number)

    assert response.status_code == 200
    assert {"access", "refresh"} <= response.json().keys()


def test_connexion_accepte_un_numero_avec_espaces(api_client, make_user):
    make_user(phone_number="+221771234567")

    response = login(api_client, "+221 77 123 45 67")

    assert response.status_code == 200


def test_mauvais_mot_de_passe_refuse(api_client, user):
    response = login(api_client, user.phone_number, password="faux-mot-de-passe")

    assert response.status_code == 401
    assert "access" not in response.json()


def test_compte_desactive_refuse(api_client, make_user):
    inactive = make_user(is_active=False)

    response = login(api_client, inactive.phone_number)

    assert response.status_code == 401


def test_connexion_met_a_jour_last_login(api_client, user):
    login(api_client, user.phone_number)

    user.refresh_from_db()
    assert user.last_login is not None


def test_rafraichissement_donne_de_nouveaux_jetons(api_client, user):
    refresh = login(api_client, user.phone_number).json()["refresh"]

    response = api_client.post(reverse("token-refresh"), {"refresh": refresh}, format="json")

    assert response.status_code == 200
    assert response.json()["refresh"] != refresh


def test_ancien_jeton_de_rafraichissement_inutilisable_apres_rotation(api_client, user):
    refresh = login(api_client, user.phone_number).json()["refresh"]
    api_client.post(reverse("token-refresh"), {"refresh": refresh}, format="json")

    response = api_client.post(reverse("token-refresh"), {"refresh": refresh}, format="json")

    assert response.status_code == 401


def test_deconnexion_invalide_le_jeton_de_rafraichissement(api_client, user):
    refresh = login(api_client, user.phone_number).json()["refresh"]

    logout = api_client.post(reverse("token-logout"), {"refresh": refresh}, format="json")
    response = api_client.post(reverse("token-refresh"), {"refresh": refresh}, format="json")

    assert logout.status_code == 200
    assert response.status_code == 401


def test_jeton_d_acces_donne_acces_a_me(api_client, user):
    access = login(api_client, user.phone_number).json()["access"]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = api_client.get(reverse("me"))

    assert response.status_code == 200
    assert response.json()["phone_number"] == user.phone_number


def test_jeton_invalide_refuse(api_client):
    api_client.credentials(HTTP_AUTHORIZATION="Bearer jeton-invalide")

    assert api_client.get(reverse("me")).status_code == 401
