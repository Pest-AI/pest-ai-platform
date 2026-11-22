# Standards de code

## Général

- Code, noms de variables et de fonctions en **anglais**. Documentation, commentaires métier et messages d'erreur destinés aux utilisateurs en **français**.
- Pas de secret dans le code : tout passe par les variables d'environnement.
- Toute fonctionnalité arrive avec ses tests.

## Backend (Python / Django)

**Outils :** Ruff (lint) et Black (format), longueur de ligne 100, Python 3.12. Ils sont exécutés par pre-commit.

**Organisation d'une app** (`backend/apps/<nom>/`) :

| Fichier | Contient | Ne contient pas |
|---|---|---|
| `models.py` | Champs, contraintes, index | Logique métier complexe |
| `services.py` | Écritures, règles métier, transactions | Requêtes HTTP |
| `selectors.py` | Lectures, filtres, requêtes optimisées | Écritures |
| `serializers.py` | Validation des entrées, format des sorties | Logique métier |
| `views.py` | Authentification, permissions, appel des services et selectors | Requêtes ORM complexes |

**Règles issues du Database Design v2.2 :**

- Mixins communs dans `apps/core` : BASE (UUID, dates), ARCH (archivage), TENANT (organisation), SPACE (`space_key`), SYNC (`row_version`).
- Archivage : `objects` renvoie tout, `active_objects` ne renvoie que les lignes actives.
- `created_by` et `updated_by` sont renseignés explicitement par les services.
- Contraintes d'intégrité en base (contraintes, index uniques, clés composites) plutôt que seulement en Python.
- Mots de passe : PBKDF2.

**API :**

- Routes versionnées sous `/api/v1/`, noms au pluriel et en kebab-case (`/api/v1/field-observations/`).
- Espace de travail via l'en-tête `X-Workspace` : 400 si absent ou invalide, 403 si non autorisé, 404 pour un objet d'une autre organisation.
- Chaque endpoint est documenté dans le schéma OpenAPI (drf-spectacular).

**Tests :**

- `pytest` + `pytest-django`. Un fichier `test_<sujet>.py` par sujet.
- Noms de tests explicites, en français accepté : `test_agent_ne_voit_pas_les_parcelles_d_une_autre_organisation`.
- Tester les permissions et l'isolation entre organisations pour chaque endpoint.

**Migrations :**

- Générées seulement quand les modèles concernés sont validés.
- Relues dans la PR. Jamais appliquées sur staging ou production sans validation.

## Frontend et mobile (TypeScript)

Règles détaillées ajoutées au J6 (Next.js) et au J9 (Expo) : ESLint, Prettier, TypeScript strict, client API généré depuis le schéma OpenAPI.
