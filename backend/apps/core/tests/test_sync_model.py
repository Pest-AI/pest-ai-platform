"""Tests du mixin SYNC : row_version +1 à chaque modification."""

import pytest

from apps.core import services
from tests.testapp.models import SampleRecord

pytestmark = pytest.mark.django_db


def test_row_version_vaut_1_a_la_creation():
    record = SampleRecord.objects.create(reference="R1")

    assert record.row_version == 1


def test_row_version_augmente_a_chaque_save():
    record = SampleRecord.objects.create(reference="R1")

    record.label = "Première modification"
    record.save()
    assert record.row_version == 2

    record.label = "Deuxième modification"
    record.save()
    assert record.row_version == 3


def test_row_version_augmente_avec_update_fields():
    record = SampleRecord.objects.create(reference="R1")

    record.label = "Modifié"
    record.save(update_fields=["label"])
    record.refresh_from_db()

    assert record.row_version == 2
    assert record.label == "Modifié"


def test_row_version_augmente_avec_une_mise_a_jour_en_masse():
    SampleRecord.objects.create(reference="R1")
    SampleRecord.objects.create(reference="R2")

    SampleRecord.objects.update(label="Lot")

    assert set(SampleRecord.objects.values_list("row_version", flat=True)) == {2}


def test_row_version_augmente_quand_on_archive(make_user):
    user = make_user()
    record = SampleRecord.objects.create(reference="R1")

    services.archive(record, by=user)

    assert record.row_version == 2


def test_deux_copies_concurrentes_ne_perdent_pas_d_increment():
    record = SampleRecord.objects.create(reference="R1")
    copie_a = SampleRecord.objects.get(pk=record.pk)
    copie_b = SampleRecord.objects.get(pk=record.pk)

    copie_a.save()
    copie_b.save()

    record.refresh_from_db()
    assert record.row_version == 3


def test_horodatages_hors_ligne_facultatifs():
    record = SampleRecord.objects.create(reference="R1")

    assert record.client_created_at is None
    assert record.server_received_at is None
