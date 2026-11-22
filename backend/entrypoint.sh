#!/bin/sh
# Démarrage du conteneur de production (Render).
# 1. Applique les migrations (les 7 rôles se chargent automatiquement ensuite).
# 2. Crée le compte d'administration initial si les variables sont définies (idempotent).
# 3. Lance gunicorn.
set -e

echo "[démarrage] Migrations…"
python manage.py migrate --noinput

echo "[démarrage] Compte d'administration initial…"
python manage.py ensure_initial_admin

echo "[démarrage] Serveur sur le port ${PORT:-10000}"
exec gunicorn config.wsgi:application \
    --bind "0.0.0.0:${PORT:-10000}" \
    --workers "${GUNICORN_WORKERS:-2}" \
    --timeout "${GUNICORN_TIMEOUT:-60}" \
    --access-logfile - \
    --error-logfile -
