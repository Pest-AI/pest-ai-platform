"""Tests du mixin BASE."""

import uuid

import pytest

from tests.testapp.models import SimpleRecord

pytestmark = pytest.mark.django_db


def test_identifiant_uuid_genere_a_la_creation():
    record = SimpleRecord.objects.create(label="A")

    assert isinstance(record.id, uuid.UUID)


def test_dates_de_creation_et_de_modification_renseignees():
    record = SimpleRecord.objects.create(label="A")
    created_at = record.created_at

    record.label = "B"
    record.save()

    assert record.created_at == created_at
    assert record.updated_at >= created_at


def test_auteurs_vides_par_defaut_et_renseignes_explicitement(make_user):
    user = make_user()

    record = SimpleRecord.objects.create(label="A")
    assert record.created_by is None
    assert record.updated_by is None

    record = SimpleRecord.objects.create(label="B", created_by=user, updated_by=user)
    assert record.created_by == user


def test_suppression_de_l_auteur_ne_supprime_pas_l_enregistrement(make_user):
    user = make_user()
    record = SimpleRecord.objects.create(label="A", created_by=user)

    user.delete()
    record.refresh_from_db()

    assert record.created_by is None
