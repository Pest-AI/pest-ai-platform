"""Tests de la session web de l'app terrain (PWA) : cookie httpOnly et contrôle d'origine."""

import pytest
from django.urls import reverse

from conftest import TEST_PASSWORD

pytestmark = pytest.mark.django_db

ORIGIN = "https://terrain.example"
COOKIE = "pestai_terrain_refresh"


@pytest.fixture(autouse=True)
def _origine_autorisee(settings):
    settings.WEB_SESSION_ALLOWED_ORIGINS = [ORIGIN]
    settings.WEB_SESSION_COOKIE_SECURE = True


def web_login(client, phone, password=TEST_PASSWORD, origin=ORIGIN):
    headers = {"HTTP_ORIGIN": origin} if origin else {}
    return client.post(
        reverse("web-token"),
        {"phone_number": phone, "password": password},
        format="json",
        **headers,
    )


def post(client, name, origin=ORIGIN):
    headers = {"HTTP_ORIGIN": origin} if origin else {}
    return client.post(reverse(name), format="json", **headers)


def test_connexion_pose_un_cookie_httponly_et_ne_renvoie_que_l_acces(api_client, user):
    res = web_login(api_client, user.phone_number)
    assert res.status_code == 200
    assert set(res.data) == {"access"}
    cookie = res.cookies[COOKIE]
    assert cookie.value
    assert cookie["httponly"]
    assert cookie["secure"]
    assert cookie["samesite"] == "Strict"
    assert cookie["path"] == "/api/v1/auth/web/"
    assert int(cookie["max-age"]) == 7 * 24 * 3600


def test_le_jeton_d_acces_ouvre_l_api(api_client, user):
    access = web_login(api_client, user.phone_number).data["access"]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    assert api_client.get(reverse("me")).status_code == 200


def test_mauvais_mot_de_passe(api_client, user):
    res = web_login(api_client, user.phone_number, "faux")
    assert res.status_code == 401
    assert COOKIE not in res.cookies


@pytest.mark.parametrize("origin", [None, "https://site-malveillant.example"])
def test_origine_refusee_partout(api_client, user, origin):
    assert web_login(api_client, user.phone_number, origin=origin).status_code == 403
    web_login(api_client, user.phone_number)  # session valide, pour tester refresh et logout
    assert post(api_client, "web-refresh", origin=origin).status_code == 403
    assert post(api_client, "web-logout", origin=origin).status_code == 403
    # La session n'a pas été touchée.
    assert post(api_client, "web-refresh").status_code == 200


def test_renouvellement_tourne_le_cookie(api_client, user):
    first = web_login(api_client, user.phone_number).cookies[COOKIE].value
    res = post(api_client, "web-refresh")
    assert res.status_code == 200
    assert set(res.data) == {"access"}
    second = res.cookies[COOKIE].value
    assert second and second != first
    # L'ancien jeton est sur liste noire : le réutiliser échoue et efface le cookie.
    api_client.cookies[COOKIE] = first
    replay = post(api_client, "web-refresh")
    assert replay.status_code == 401
    assert replay.cookies[COOKIE].value == ""


def test_renouvellement_sans_cookie(api_client):
    assert post(api_client, "web-refresh").status_code == 401


def test_deconnexion_revoque_et_efface(api_client, user):
    web_login(api_client, user.phone_number)
    token = api_client.cookies[COOKIE].value
    res = post(api_client, "web-logout")
    assert res.status_code == 204
    assert res.cookies[COOKIE].value == ""
    api_client.cookies[COOKIE] = token
    assert post(api_client, "web-refresh").status_code == 401


def test_deconnexion_sans_session(api_client):
    assert post(api_client, "web-logout").status_code == 204


def test_connexion_web_limitee_par_numero(api_client, user):
    from rest_framework.settings import api_settings

    from apps.accounts.throttling import LoginAttemptThrottle

    LoginAttemptThrottle.THROTTLE_RATES = {"auth_login": "2/min"}
    try:
        codes = [web_login(api_client, user.phone_number, "x").status_code for _ in range(3)]
    finally:
        LoginAttemptThrottle.THROTTLE_RATES = api_settings.DEFAULT_THROTTLE_RATES
    assert codes == [401, 401, 429]
