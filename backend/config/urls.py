"""Routes principales de l'API PEST AI OS.

Toutes les routes métier sont versionnées sous /api/v1/.
"""

from django.contrib import admin
from django.urls import include, path

from config.views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/health/", health, name="health"),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.organizations.urls")),
]
