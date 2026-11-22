"""Vues techniques de la plateforme (hors domaines métier)."""

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def health(request):
    """Indique que l'API répond. Utilisé par Render et par la supervision."""
    return JsonResponse(
        {"status": "ok", "service": "pest-ai-os-api", "version": settings.PEST_AI_VERSION}
    )
