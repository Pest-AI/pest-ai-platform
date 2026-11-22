# Image de production de l'API PEST AI OS (Render, mode Docker).
# Contexte de construction : le dossier backend/ (voir render.yaml).
#
# Debian 13 « trixie » fournit GDAL 3.10 : la production respecte GDAL >= 3.9
# exigé par Django pour bloquer les accès réseau des références spatiales (ADR-0007).
FROM python:3.12-slim-trixie

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DJANGO_SETTINGS_MODULE=config.settings.production \
    PORT=10000

# Bibliothèques géographiques pour GeoDjango (GDAL, GEOS, PROJ).
RUN apt-get update \
    && apt-get install -y --no-install-recommends gdal-bin libgdal-dev binutils libproj-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dépendances d'abord : couche mise en cache tant que requirements/ ne change pas.
COPY requirements/ requirements/
RUN pip install -r requirements/production.txt

COPY . .

# Fichiers statiques (admin Django) servis par WhiteNoise.
# Valeurs factices : uniquement pour cette étape de construction, jamais utilisées à l'exécution.
RUN DJANGO_SECRET_KEY=construction-uniquement \
    DATABASE_URL=postgis://construction@localhost/construction \
    python manage.py collectstatic --noinput

# L'application ne tourne pas en root.
RUN useradd --create-home --uid 1000 pestai \
    && chmod +x /app/entrypoint.sh \
    && chown -R pestai:pestai /app
USER pestai

EXPOSE 10000
CMD ["/app/entrypoint.sh"]
