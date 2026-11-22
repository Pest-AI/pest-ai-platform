"""Paramètres communs à tous les environnements.

Les valeurs propres à chaque machine ou environnement (secrets, base de données,
chemins GDAL) sont lues depuis les variables d'environnement, ou depuis le fichier
`backend/.env` en local. Voir `backend/.env.example`.
"""

from pathlib import Path

import environ

# backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
_env_file = BASE_DIR / ".env"
if _env_file.exists():
    # Les variables déjà définies dans l'environnement ne sont pas écrasées.
    environ.Env.read_env(_env_file)

PEST_AI_VERSION = "0.0.1-dev"

# ── Sécurité ──────────────────────────────────────────────
SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])

# ── Bibliothèques géographiques (GeoDjango) ───────────────
# Chemins explicites pour macOS (Postgres.app ou Homebrew).
# Laisser vide sur Linux / Docker : Django les trouve tout seul.
GDAL_LIBRARY_PATH = env("GDAL_LIBRARY_PATH", default=None) or None
GEOS_LIBRARY_PATH = env("GEOS_LIBRARY_PATH", default=None) or None

# ── Applications ──────────────────────────────────────────
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.gis",
]
THIRD_PARTY_APPS = [
    "rest_framework",
    "django_filters",
    "corsheaders",
]
# Les apps métier (apps/<nom>) sont ajoutées ici au fil du planning.
LOCAL_APPS: list[str] = []

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ── Base de données : PostgreSQL 16 + PostGIS ─────────────
# Format : postgis://UTILISATEUR:MOT_DE_PASSE@HÔTE:PORT/NOM_BASE
DATABASES = {"default": env.db("DATABASE_URL")}
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=60)

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── Authentification ──────────────────────────────────────
# Le modèle utilisateur personnalisé (accounts.User) arrive au J2.
# Aucune migration ne doit être appliquée avant.
# Hachage : PBKDF2 (décision du 20/11/2026).
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ── Langue et fuseau horaire ──────────────────────────────
LANGUAGE_CODE = "fr"
TIME_ZONE = "Africa/Dakar"
USE_I18N = True
USE_TZ = True

# ── Fichiers statiques ────────────────────────────────────
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# ── API (Django REST Framework) ───────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
}

# ── CORS (frontend Next.js, site de documentation) ────────
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])

# ── Journalisation ────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {"format": "{asctime} {levelname} {name} {message}", "style": "{"},
    },
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "simple"}},
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", default="INFO")},
}
