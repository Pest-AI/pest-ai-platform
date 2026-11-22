"""Modèles de test : ils servent à tester les mixins abstraits de apps.core.

Ces tables n'existent que dans la base de test, créée par pytest.
"""

from django.db import models

from apps.core.models import ArchivableModel, BaseModel, ImmutableFieldsMixin, SyncModel


class SampleRecord(ImmutableFieldsMixin, BaseModel, ArchivableModel, SyncModel):
    """Enregistrement avec les mixins BASE, ARCH et SYNC."""

    IMMUTABLE_FIELDS = ("reference",)

    reference = models.CharField(max_length=20)
    label = models.CharField(max_length=100, blank=True, default="")


class SimpleRecord(BaseModel):
    """Enregistrement avec le seul mixin BASE (ni archivage ni synchronisation)."""

    label = models.CharField(max_length=100)
