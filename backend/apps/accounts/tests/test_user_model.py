"""Tests du modèle User (Database Design v2.2)."""

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from conftest import TEST_PASSWORD

pytestmark = pytest.mark.django_db
User = get_user_model()


def test_connexion_par_numero_de_telephone():
    assert User.USERNAME_FIELD == "phone_number"


def test_numero_normalise_a_la_creation(make_user):
    user = make_user(phone_number="00221 77 123 45 67")

    assert user.phone_number == "+221771234567"


def test_numero_invalide_refuse(make_user):
    with pytest.raises(ValidationError):
        make_user(phone_number="771234567")


def test_numero_unique(make_user):
    make_user(phone_number="+221771234567")

    with pytest.raises(ValidationError):
        make_user(phone_number="+221 77 123 45 67")


def test_mot_de_passe_hache_en_pbkdf2_hors_tests(settings, make_user):
    # Les tests utilisent un hachage rapide ; on réapplique ici le réglage réel du projet.
    from config.settings import base

    settings.PASSWORD_HASHERS = base.PASSWORD_HASHERS
    user = make_user()

    assert user.password.startswith("pbkdf2_sha256$")


def test_mot_de_passe_jamais_stocke_en_clair(make_user):
    user = make_user()

    assert user.password != TEST_PASSWORD
    assert user.check_password(TEST_PASSWORD)


def test_email_facultatif_et_chaine_vide_devient_null(make_user):
    user = make_user(email="")

    assert user.email is None


def test_email_unique_sans_tenir_compte_des_majuscules(make_user):
    make_user(email="awa@pest.ai")

    with pytest.raises(ValidationError):
        make_user(email="AWA@pest.ai")


def test_plusieurs_comptes_sans_email_autorises(make_user):
    make_user(email=None)
    make_user(email=None)

    assert User.objects.filter(email__isnull=True).count() == 2


def test_langue_par_defaut_francais(make_user):
    assert make_user().preferred_language == "fr"


def test_utilisateur_ordinaire_sans_acces_admin(make_user):
    user = make_user()

    assert user.is_active and not user.is_staff and not user.is_superuser


def test_superutilisateur_technique():
    admin = User.objects.create_superuser(
        phone_number="+221770009999", password=TEST_PASSWORD, first_name="Admin", last_name="PEST"
    )

    assert admin.is_staff and admin.is_superuser


def test_nom_complet(make_user):
    user = make_user(first_name="Awa", last_name="Diallo")

    assert user.full_name == "Awa Diallo"
