"""Paramètres communs à tous les environnements.

Les valeurs propres à chaque machine ou environnement (secrets, base de données,
chemins GDAL) sont lues depuis les variables d'environnement, ou depuis le fichier
`backend/.env` en local. Voir `backend/.env.example`.
"""

from datetime import timedelta
from pathlib import Path

import environ

# backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
_env_file = BASE_DIR / ".env"
if _env_file.exists():
    # Les variables déjà définies dans l'environnement ne sont pas écrasées.
    environ.Env.read_env(_env_file)

PEST_AI_VERSION = "0.0.1"
# Environnement affiché par /api/v1/health/ : local, staging, production.
PEST_AI_ENVIRONMENT = env("PEST_AI_ENVIRONMENT", default="local")

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
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "corsheaders",
    "drf_spectacular",
]
# Les apps métier (apps/<nom>) sont ajoutées ici au fil du planning.
LOCAL_APPS = [
    "apps.core",
    "apps.accounts",
    "apps.organizations",
]

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
        "DIRS": [BASE_DIR / "templates"],
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
# Render fournit une URL « postgres:// » : on impose toujours le moteur PostGIS.
DATABASES["default"]["ENGINE"] = "django.contrib.gis.db.backends.postgis"
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=60)

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── Authentification ──────────────────────────────────────
# Utilisateur personnalisé : connexion par numéro de téléphone (Design v2.2).
AUTH_USER_MODEL = "accounts.User"
# Hachage : PBKDF2 (décision du 20/11/2026).
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
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
# Tout est privé par défaut : chaque route exige un jeton JWT valide,
# sauf celles qui déclarent explicitement AllowAny (connexion, santé).
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_SCHEMA_CLASS": "apps.core.schema.PestAutoSchema",
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    # Listes paginées : {"count", "next", "previous", "results"}, 50 éléments par page.
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    # Limitation de fréquence des routes publiques sensibles (par adresse IP).
    "DEFAULT_THROTTLE_RATES": {
        "account_activation": env.str("THROTTLE_ACCOUNT_ACTIVATION", default="20/hour"),
    },
}

# ── Jetons JWT (SimpleJWT) ────────────────────────────────
# Jeton d'accès court ; jeton de rafraîchissement renouvelé à chaque usage,
# l'ancien étant mis sur liste noire (déconnexion effective).
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_TOKEN_MINUTES", default=15)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_TOKEN_DAYS", default=7)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# ── Documentation de l'API (OpenAPI 3) ────────────────────
SPECTACULAR_SETTINGS = {
    "TITLE": "PEST AI OS — API",
    "DESCRIPTION": (
        "API centrale de PEST AI OS : comptes, organisations, producteurs, parcelles, "
        "observations, diagnostics.\n\n"
        "**Authentification** : `Authorization: Bearer <jeton>` "
        "(voir `POST /api/v1/auth/token/`).\n\n"
        "**Espace de travail** : les routes d'organisation exigent l'en-tête "
        "`X-Workspace: org:<uuid>`."
    ),
    "VERSION": PEST_AI_VERSION,
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": r"/api/v1",
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_NAME_OVERRIDES": {
        "MembershipStatusEnum": "apps.organizations.models.MembershipStatus",
        "OrganizationStatusEnum": "apps.organizations.models.OrganizationStatus",
    },
    "TAGS": [
        {"name": "auth", "description": "Connexion, jetons JWT, déconnexion."},
        {"name": "me", "description": "Compte de l'utilisateur connecté."},
        {"name": "organization", "description": "Organisation de l'espace de travail actif."},
        {"name": "memberships", "description": "Membres et rôles de l'organisation active."},
        {"name": "platform", "description": "Administration de la plateforme (super_admin)."},
    ],
}

# ── CORS (frontend Next.js, site de documentation) ────────
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

# ── Journalisation ────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {"format": "{asctime} {levelname} {name} {message}", "style": "{"},
    },
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "simple"}},
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", default="INFO")},
    "loggers": {
        # Événements de sécurité (accès refusés, accès inter-organisations, changements
        # de rôles). Remplacé par le journal d'audit en base au J26.
        "pestai.security": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}
