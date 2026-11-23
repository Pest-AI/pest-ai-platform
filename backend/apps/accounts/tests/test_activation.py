"""Activation d'un compte créé par invitation : POST /api/v1/auth/activate/."""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.accounts.activation import MAX_FAILED_ATTEMPTS, issue_activation_code
from apps.accounts.models import AccountActivation, User

pytestmark = pytest.mark.django_db
URL = "/api/v1/auth/activate/"
PHONE = "+221781112233"
NEW_PASSWORD = "Riz-Sahel-108-Ross"


@pytest.fixture
def invited():
    """Compte créé par invitation (sans mot de passe) et son code."""
    user = User.objects.create_user(PHONE, password=None, first_name="Moussa", last_name="Diop")
    code, _ = issue_activation_code(user=user, issued_by=None)
    return user, code


def activate(api_client, **payload):
    return api_client.post(URL, payload, format="json")


def test_activation_fixe_le_mot_de_passe_et_permet_la_connexion(api_client, invited):
    user, code = invited
    response = activate(
        api_client, phone_number="+221 78 111 22 33", code=code.lower(), new_password=NEW_PASSWORD
    )
    assert response.status_code == 204
    user.refresh_from_db()
    assert user.check_password(NEW_PASSWORD)

    token = api_client.post(
        reverse("token-obtain"), {"phone_number": PHONE, "password": NEW_PASSWORD}, format="json"
    )
    assert token.status_code == 200


def test_code_a_usage_unique(api_client, invited):
    _, code = invited
    assert (
        activate(api_client, phone_number=PHONE, code=code, new_password=NEW_PASSWORD).status_code
        == 204
    )
    assert (
        activate(
            api_client, phone_number=PHONE, code=code, new_password="Autre-Mot-2026"
        ).status_code
        == 400
    )


def test_code_faux_numero_inconnu_et_code_expire_meme_message(api_client, invited):
    user, code = invited
    wrong = activate(api_client, phone_number=PHONE, code="AAAA-AAAA", new_password=NEW_PASSWORD)
    unknown = activate(
        api_client, phone_number="+221700000000", code=code, new_password=NEW_PASSWORD
    )
    AccountActivation.objects.filter(user=user).update(
        expires_at=timezone.now() - timedelta(minutes=1)
    )
    expired = activate(api_client, phone_number=PHONE, code=code, new_password=NEW_PASSWORD)
    assert wrong.status_code == unknown.status_code == expired.status_code == 400
    assert wrong.json() == unknown.json() == expired.json()


def test_code_annule_apres_trop_d_essais(api_client, invited):
    _, code = invited
    for _ in range(MAX_FAILED_ATTEMPTS):
        activate(api_client, phone_number=PHONE, code="AAAA-AAAA", new_password=NEW_PASSWORD)
    # Même le bon code ne fonctionne plus : le gérant doit en émettre un nouveau.
    assert (
        activate(api_client, phone_number=PHONE, code=code, new_password=NEW_PASSWORD).status_code
        == 400
    )


def test_mot_de_passe_trop_faible_refuse_sans_consommer_le_code(api_client, invited):
    _, code = invited
    assert (
        activate(api_client, phone_number=PHONE, code=code, new_password="123").status_code == 400
    )
    assert (
        activate(api_client, phone_number=PHONE, code=code, new_password=NEW_PASSWORD).status_code
        == 204
    )


def test_compte_deja_active_n_a_pas_de_code(make_user):
    from django.core.exceptions import ValidationError

    with pytest.raises(ValidationError):
        issue_activation_code(user=make_user(), issued_by=None)


def test_limitation_de_frequence(api_client, invited, settings):
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        "DEFAULT_THROTTLE_RATES": {"account_activation": "3/hour"},
    }
    from rest_framework.throttling import ScopedRateThrottle

    ScopedRateThrottle.THROTTLE_RATES = {"account_activation": "3/hour"}
    try:
        codes = [
            activate(
                api_client, phone_number=PHONE, code="AAAA-AAAA", new_password=NEW_PASSWORD
            ).status_code
            for _ in range(4)
        ]
    finally:
        from rest_framework.settings import api_settings

        ScopedRateThrottle.THROTTLE_RATES = api_settings.DEFAULT_THROTTLE_RATES
    assert codes[-1] == 429
