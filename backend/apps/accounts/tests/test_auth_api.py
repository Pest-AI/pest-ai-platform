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


def test_tentatives_de_connexion_limitees_par_numero(api_client, user, make_user):
    from rest_framework.settings import api_settings

    from apps.accounts.throttling import LoginAttemptThrottle

    LoginAttemptThrottle.THROTTLE_RATES = {"auth_login": "3/min"}
    try:
        codes = [
            login(api_client, user.phone_number, "mauvais-mot-de-passe").status_code
            for _ in range(4)
        ]
        # Même le bon mot de passe est refusé tant que la limite court.
        blocked = login(api_client, user.phone_number)
        # Un autre numéro n'est pas touché (même adresse IP).
        other = make_user(phone_number="+221770009999")
        other_code = login(api_client, other.phone_number).status_code
    finally:
        LoginAttemptThrottle.THROTTLE_RATES = api_settings.DEFAULT_THROTTLE_RATES
    assert codes[:3] == [401, 401, 401]
    assert codes[3] == 429
    assert blocked.status_code == 429
    assert "Retry-After" in blocked
    assert other_code == 200


def test_limite_de_connexion_insensible_au_format_du_numero(api_client, user):
    from rest_framework.settings import api_settings

    from apps.accounts.throttling import LoginAttemptThrottle

    spaced = user.phone_number[:4] + " " + user.phone_number[4:6] + " " + user.phone_number[6:]
    LoginAttemptThrottle.THROTTLE_RATES = {"auth_login": "2/min"}
    try:
        codes = [
            login(api_client, n, "x").status_code
            for n in (user.phone_number, spaced, user.phone_number)
        ]
    finally:
        LoginAttemptThrottle.THROTTLE_RATES = api_settings.DEFAULT_THROTTLE_RATES
    assert codes[-1] == 429
