"""Tests du mixin ARCH et des services d'archivage."""

import pytest
from django.contrib.auth import get_user_model

from apps.core import services
from tests.testapp.models import SampleRecord

pytestmark = pytest.mark.django_db


@pytest.fixture
def user():
    return get_user_model().objects.create_user(username="manager", password="x")


def test_objects_renvoie_tout_et_active_objects_les_lignes_actives(user):
    actif = SampleRecord.objects.create(reference="R1")
    archive = SampleRecord.objects.create(reference="R2")
    services.archive(archive, by=user, reason="Doublon")

    assert set(SampleRecord.objects.all()) == {actif, archive}
    assert list(SampleRecord.active_objects.all()) == [actif]
    assert list(SampleRecord.objects.active()) == [actif]


def test_objects_est_le_gestionnaire_par_defaut():
    assert SampleRecord._default_manager.name == "objects"


def test_archiver_renseigne_auteur_date_et_motif(user):
    record = SampleRecord.objects.create(reference="R1")

    services.archive(record, by=user, reason="Parcelle abandonnée")
    record.refresh_from_db()

    assert record.is_archived is True
    assert record.archived_at is not None
    assert record.archived_by == user
    assert record.archive_reason == "Parcelle abandonnée"
    assert record.updated_by == user


def test_archiver_deux_fois_ne_change_rien(user):
    record = SampleRecord.objects.create(reference="R1")
    services.archive(record, by=user)
    archived_at = record.archived_at

    services.archive(record, by=user)

    assert record.archived_at == archived_at


def test_restaurer_remet_l_enregistrement_actif(user):
    record = SampleRecord.objects.create(reference="R1")
    services.archive(record, by=user, reason="Erreur")

    services.restore(record, by=user)
    record.refresh_from_db()

    assert record.is_archived is False
    assert record.archived_at is None
    assert record.archived_by is None
    assert record.archive_reason == ""
    assert record in SampleRecord.active_objects.all()


def test_archiver_ne_supprime_jamais_la_ligne(user):
    record = SampleRecord.objects.create(reference="R1")

    services.archive(record, by=user)

    assert SampleRecord.objects.filter(pk=record.pk).exists()
