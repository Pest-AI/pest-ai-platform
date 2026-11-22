"""Génération du schéma OpenAPI (drf-spectacular).

Ajoute automatiquement l'en-tête obligatoire X-Workspace à toutes les routes
protégées par WorkspacePermission : la documentation ne peut pas l'oublier.
"""

from drf_spectacular.openapi import AutoSchema
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter

from apps.core.permissions import WorkspacePermission

X_WORKSPACE = OpenApiParameter(
    name="X-Workspace",
    type=OpenApiTypes.STR,
    location=OpenApiParameter.HEADER,
    required=True,
    description=(
        "Espace de travail dans lequel vous agissez : `org:<uuid-de-l-organisation>`. "
        "La valeur à utiliser est donnée par `GET /api/v1/me/` (champ `memberships[].workspace`). "
        "Absent ou mal formé : 400. Pas d'adhésion active : 403."
    ),
)


class PestAutoSchema(AutoSchema):
    def get_override_parameters(self):
        parameters = super().get_override_parameters()
        permission_classes = getattr(self.view, "permission_classes", [])
        if any(
            isinstance(p, type) and issubclass(p, WorkspacePermission) for p in permission_classes
        ):
            parameters = [*parameters, X_WORKSPACE]
        return parameters
