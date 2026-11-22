# CLAUDE.md — consignes pour les assistants IA (Claude Code)

Ce fichier est lu par Claude Code quand il travaille dans ce dépôt. Les humains peuvent le lire aussi : il résume les règles du projet.

## Projet

PEST AI OS : plateforme d'intelligence agricole (Ecliptix SAS). Monorepo :
`backend/` (Django 5.2 LTS + DRF + PostgreSQL 16/PostGIS), `frontend/` (Next.js), `mobile/` (Expo), `docs-site/` (Docusaurus + Scalar), `infrastructure/`, `docs/`.

Références obligatoires avant de coder :
- `docs/01-architecture/` et les ADR dans `docs/01-architecture/adr/`
- `docs/02-database/PEST-AI-OS-Database-Design-MVP-Scope-v2.2.pdf` et le registre de décisions v2.1

## Règles de sécurité (impératives)

- Ne jamais lire, afficher ni modifier un fichier `.env`. Ne jamais afficher de clé, mot de passe ou token.
- Ne lancer aucune migration (`migrate`) sans autorisation explicite. `makemigrations` uniquement quand les modèles concernés sont validés.
- Ne supprimer aucune donnée, ne jamais réinitialiser PostgreSQL, ne pas modifier les rôles ou permissions de la base.
- Aucun commit ni push sans autorisation. Phase actuelle : développement solo du fondateur sur `main` (voir CONTRIBUTING) ; ne jamais pousser à sa place.
- Ne pas remplacer une décision d'architecture validée sans ADR approuvé.
- Ne jamais présenter un test non exécuté comme réussi. Signaler tout échec.

## Conventions backend

- Apps Django dans `backend/apps/<nom>/`. Logique métier dans `services.py`, lectures dans `selectors.py`, pas dans les vues ni les serializers.
- Les auteurs (`created_by`, `updated_by`) sont renseignés explicitement par la couche service.
- Utilisateur : `accounts.User`, connexion par téléphone E.164, e-mail facultatif unique. Mots de passe en PBKDF2.
- API privée par défaut (JWT + IsAuthenticated). Tests : fixtures `make_user`, `user`, `api_client`, `auth_client` dans `backend/conftest.py`.
- Multi-tenant : en-tête `X-Workspace` (`org:<uuid>` ou `personal`) ; 400 si absent ou invalide, 403 si non autorisé, 404 pour un objet d'une autre organisation.
- Tests : `pytest` dans `backend/tests/` ou `backend/apps/<nom>/tests/`.

## Commandes utiles (depuis la racine du dépôt)

```bash
make verifier    # qualité + migrations + tests : à lancer avant tout commit
make tests       # tests uniquement
make serveur     # serveur local
make aide        # liste des commandes
```

## Mixins communs (`apps/core/models.py`)

`BaseModel` (BASE), `ArchivableModel` (ARCH), `SyncModel` (SYNC), `ImmutableFieldsMixin`. TENANT (J3) et SPACE (J10) arrivent avec Organization et Producer. Archiver / restaurer : `apps.core.services.archive()` / `restore()`, auteur passé explicitement.
