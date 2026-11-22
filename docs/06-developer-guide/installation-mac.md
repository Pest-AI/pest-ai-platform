# Installation de l'environnement de développement (macOS)

Ce guide permet à un nouveau développeur de faire tourner le backend PEST AI OS sur un Mac (Apple Silicon ou Intel) en 30 à 60 minutes.

## 1. Outils à installer

| Outil | Version | Rôle | Installation |
|---|---|---|---|
| Outils de ligne de commande Apple | — | Compilateurs, Git | `xcode-select --install` |
| Homebrew | dernière | Gestionnaire de paquets | [brew.sh](https://brew.sh) |
| Python | **3.12** | Backend Django | `brew install python@3.12` |
| PostgreSQL + PostGIS | **16** | Base de données locale | [Postgres.app](https://postgresapp.com) (inclut PostGIS) |
| Node.js | LTS (version paire) | Frontend, mobile, site de documentation | `brew install node` |
| pnpm | dernière | Paquets JavaScript | `brew install pnpm` |
| GitHub CLI | dernière | Pull requests depuis le terminal | `brew install gh` puis `gh auth login` |
| Docker Desktop | dernière | Tester l'image de production (Render) | `brew install --cask docker-desktop` |
| VS Code | dernière | Éditeur | [code.visualstudio.com](https://code.visualstudio.com) |

Vérification rapide :

```bash
python3.12 --version && psql --version && node --version && pnpm --version && gh --version && docker --version
```

## 2. Bibliothèques géographiques (GDAL, GEOS)

GeoDjango a besoin de GDAL et GEOS. Deux options, au choix :

**Option A — Postgres.app (recommandée pour démarrer, rien à télécharger).** Les bibliothèques sont fournies avec Postgres.app :

```bash
ls /Applications/Postgres.app/Contents/Versions/16/lib/libgdal.dylib
ls /Applications/Postgres.app/Contents/Versions/16/lib/libgeos_c.dylib
```

**Option B — Homebrew (version plus récente de GDAL).**

```bash
brew install gdal geos
ls /opt/homebrew/lib/libgdal.dylib /opt/homebrew/lib/libgeos_c.dylib
```

> **Connexion instable ?** `brew install gdal` télécharge plus de 100 dépendances (environ 3 à 4 Go). En cas d'erreur `curl: (92) HTTP/2 stream … PROTOCOL_ERROR`, forcer HTTP/1.1 puis relancer :
> ```bash
> echo "--http1.1" >> ~/.curlrc
> export HOMEBREW_CURLRC=1
> brew install gdal
> ```
> En cas d'erreur `has already locked …`, une autre installation tourne : l'arrêter (`pkill -f "brew install"`) et supprimer les fichiers partiels (`rm -f ~/Library/Caches/Homebrew/downloads/*.incomplete`).

Le chemin choisi est indiqué dans `backend/.env` (voir étape 5).

> GDAL 3.7 (Postgres.app) déclenche l'avertissement Django `gis.W001` (GDAL < 3.9). Il est masqué en développement et en test uniquement ; la production utilise GDAL ≥ 3.9. Voir [ADR-0007](../01-architecture/adr/0007-environnement-local.md).

## 3. Cloner le dépôt

```bash
cd ~/Documents
gh repo clone Pest-AI/pest-ai-platform
cd pest-ai-platform
```

## 4. Environnement Python du backend

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements/dev.txt
```

À chaque nouvelle session de terminal : `cd backend && source .venv/bin/activate`.

Dans VS Code : `Cmd + Maj + P` → « Python: Select Interpreter » → choisir `backend/.venv/bin/python`.

## 5. Configuration locale (`.env`)

```bash
cp .env.example .env
```

Ouvrir `backend/.env` et compléter :

1. `DJANGO_SECRET_KEY` : générer une clé avec
   ```bash
   python -c "from django.core.management.utils import get_random_secret_key as g; print(g())"
   ```
   et la coller à la place de `a-remplacer`.
2. `DATABASE_URL` : remplacer `VOTRE_UTILISATEUR` par votre nom d'utilisateur macOS (commande `whoami`).
3. `GDAL_LIBRARY_PATH` et `GEOS_LIBRARY_PATH` : garder l'option A (Postgres.app) ou activer l'option B (Homebrew).

> Le fichier `.env` contient des secrets : il ne doit jamais être commité, partagé ni copié dans une issue ou un message. Il est ignoré par Git et bloqué par pre-commit.

## 6. Base de données locale

Démarrer Postgres.app, puis créer la base et activer PostGIS :

```bash
createdb pestai_dev
psql -d pestai_dev -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

Puis créer les tables et un compte technique :

```bash
python manage.py migrate
python manage.py createsuperuser   # numéro au format +221…, prénom, nom, mot de passe
```

## 7. Vérifications

```bash
python manage.py check          # attendu : System check identified no issues (1 silenced).
python manage.py check --database default   # vérifie la connexion à PostGIS
pytest                          # attendu : tous les tests passent
```

Lancer le serveur :

```bash
python manage.py runserver
```

puis ouvrir <http://127.0.0.1:8000/api/v1/health/> → `{"status": "ok", ...}`. La console d'administration est sur <http://127.0.0.1:8000/admin/> (connexion avec le compte technique). La référence interactive de l'API est sur <http://127.0.0.1:8000/api/docs/> ; les guides sont dans [docs-site](../../docs-site/docs/premiers-pas.md).

## 8. Contrôles qualité

Depuis la racine du dépôt :

```bash
cd ..
backend/.venv/bin/pre-commit install   # une seule fois
make verifier                          # qualité + migrations + tests
```

pre-commit s'exécute ensuite automatiquement à chaque `git commit`. `make aide` liste toutes les commandes disponibles.

> Les tests créent une base temporaire `test_<nom_de_votre_base>` et y activent PostGIS : l'utilisateur PostgreSQL de `DATABASE_URL` doit avoir le droit superuser **sur votre poste uniquement** (`ALTER ROLE <utilisateur> SUPERUSER;` exécuté par le compte administrateur de Postgres.app).

## 9. Problèmes fréquents

| Symptôme | Cause probable | Solution |
|---|---|---|
| `Could not find the GDAL library` | Chemin GDAL absent ou faux dans `.env` | Vérifier `GDAL_LIBRARY_PATH` (étape 2) |
| `ImproperlyConfigured: Set the DJANGO_SECRET_KEY environment variable` | `.env` absent ou incomplet | Refaire l'étape 5 |
| `connection refused` sur le port 5432 | Postgres.app arrêté | Ouvrir Postgres.app et cliquer sur « Start » |
| `extension "postgis" is not available` | Mauvaise version de PostgreSQL | Utiliser le serveur PostgreSQL 16 de Postgres.app |
| `python3.12: command not found` | Python 3.12 non installé | `brew install python@3.12` |
| `permission denied to create extension "postgis"` | L'utilisateur PostgreSQL n'est pas superuser | Voir la note de l'étape 8 |
| Commit refusé par pre-commit | Format ou fichier interdit | Lire le message, corriger, refaire `git add` puis `git commit` |
