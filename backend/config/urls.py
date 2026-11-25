"""Routes principales de l'API PEST AI OS.

Toutes les routes métier sont versionnées sous /api/v1/.
"""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView

from apps.core.views import WorkspaceContextView
from config.views import api_docs, health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/health/", health, name="health"),
    # Documentation : schéma OpenAPI (YAML, ou JSON avec ?format=json) et référence interactive.
    path("api/schema/", SpectacularAPIView.as_view(), name="api-schema"),
    path("api/docs/", api_docs, name="api-docs"),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.organizations.urls")),
    path("api/v1/", include("apps.actors.urls")),
    path("api/v1/", include("apps.parcels.urls")),
    path("api/v1/", include("apps.agriculture.urls")),
    path("api/v1/", include("apps.sync.urls")),
    path("api/v1/workspace/", WorkspaceContextView.as_view(), name="workspace-context"),
]
