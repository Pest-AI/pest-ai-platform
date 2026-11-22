"""Événements de sécurité.

Provisoire : écrit dans le logger « pestai.security ». L'application audit
(AuditLog append-only, Database Design v2.2) remplacera ce mécanisme sans
changer les appels : seule la fonction `security_event` sera modifiée.
"""

import logging

logger = logging.getLogger("pestai.security")

# Actions reprises de la liste AuditLog.action du Database Design v2.2.
ACCESS_DENIED = "access_denied"
CROSS_ORG_ACCESS = "cross_org_access"
ROLE_CHANGE = "role_change"
MEMBERSHIP_CHANGE = "membership_change"
ORGANIZATION_CHANGE = "organization_change"


def security_event(
    action: str, *, user=None, organization=None, level: int = logging.INFO, **details
) -> None:
    """Journalise un événement de sécurité sous une forme structurée."""
    payload = {
        "action": action,
        "user_id": str(getattr(user, "pk", "") or ""),
        "organization_id": str(getattr(organization, "pk", "") or ""),
        **{key: str(value) for key, value in details.items()},
    }
    logger.log(level, "security_event %s", payload, extra={"security": payload})
