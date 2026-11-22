"""Services communs : archivage et restauration (mixin ARCH).

L'auteur est toujours passé explicitement (`by=`) : il n'est jamais déduit
d'un contexte implicite.
"""

from django.utils import timezone


def archive(instance, *, by, reason: str = ""):
    """Archive un enregistrement. Sans effet s'il est déjà archivé."""
    if instance.is_archived:
        return instance
    instance.is_archived = True
    instance.archived_at = timezone.now()
    instance.archived_by = by
    instance.archive_reason = reason
    instance.updated_by = by
    instance.save(
        update_fields=[
            "is_archived",
            "archived_at",
            "archived_by",
            "archive_reason",
            "updated_by",
            "updated_at",
        ]
    )
    return instance


def restore(instance, *, by):
    """Restaure un enregistrement archivé. Sans effet s'il ne l'est pas."""
    if not instance.is_archived:
        return instance
    instance.is_archived = False
    instance.archived_at = None
    instance.archived_by = None
    instance.archive_reason = ""
    instance.updated_by = by
    instance.save(
        update_fields=[
            "is_archived",
            "archived_at",
            "archived_by",
            "archive_reason",
            "updated_by",
            "updated_at",
        ]
    )
    return instance
