# Contribuer à PEST AI OS

Merci de contribuer. Ce guide décrit la façon de travailler sur le dépôt. Il est volontairement court : les détails sont dans [docs/06-developer-guide/](docs/06-developer-guide/).

## 1. Avant de commencer

1. Installer l'environnement : [installation-mac.md](docs/06-developer-guide/installation-mac.md).
2. Lire l'architecture : [docs/01-architecture/](docs/01-architecture/) et les ADR.
3. Lire le modèle de données de référence : [docs/02-database/](docs/02-database/) (Database Design v2.2).

## 2. Mode de travail : deux phases

**Phase 1 — développement solo (actuelle).** Le fondateur est le seul développeur : il commite et pousse **directement sur `main`**. Le filet de sécurité est automatique :
- `make verifier` avant chaque commit (qualité, migrations, tests) ;
- pre-commit à chaque commit (format, secrets, fichiers `.env` bloqués) ;
- la CI GitHub relance les contrôles et les tests à chaque push.

**Phase 2 — équipe (dès l'arrivée d'un deuxième développeur).** On active la protection de `main` sur GitHub (pull request obligatoire, CI verte obligatoire) et chacun travaille sur sa branche, comme décrit ci-dessous.

## 3. Branches (phase 2)

- `main` est toujours stable et déployable. On n'y pousse plus directement.
- Une branche par tâche, nommée `type/description-courte` :

| Préfixe | Usage | Exemple |
|---|---|---|
| `feat/` | Nouvelle fonctionnalité | `feat/parcelles-agroid` |
| `fix/` | Correction de bug | `fix/sync-row-version` |
| `chore/` | Outillage, configuration, dépendances | `chore/mise-a-jour-django` |
| `docs/` | Documentation uniquement | `docs/guide-installation` |
| `refactor/` | Restructuration sans changement fonctionnel | `refactor/services-organisations` |
| `test/` | Ajout ou correction de tests | `test/permissions-workspace` |

## 4. Messages de commit (toutes phases)

Format [Conventional Commits](https://www.conventionalcommits.org/fr/) :

```
type(portée): résumé à l'impératif, en minuscules

Corps facultatif : pourquoi ce changement, pas comment.
```

Exemples :
- `feat(accounts): ajouter l'authentification JWT`
- `fix(parcels): corriger le calcul de surface en hectares`
- `docs(adr): documenter le choix d'Expo`

### Pull requests (phase 2)

1. Pousser la branche : `git push -u origin <branche>`.
2. Ouvrir la PR : `gh pr create` (ou depuis GitHub), en remplissant le modèle.
3. Attendre la CI verte.
4. Fusion en **squash merge** sur `main`, puis suppression de la branche.

Une PR = un sujet. Préférer plusieurs petites PR à une grosse.

## 5. Qualité

- `make verifier` avant chaque push : il lance pre-commit (Ruff, Black, sécurité), le contrôle des migrations et les tests.
- `pre-commit` est obligatoire (installé avec `pre-commit install`) : il s'exécute à chaque commit.
- La CI GitHub (`.github/workflows/backend.yml`) relance tout sur PostgreSQL + PostGIS à chaque push.
- Toute nouvelle fonctionnalité backend arrive avec ses tests (`pytest`).
- Standards de code : [coding-standards.md](docs/06-developer-guide/coding-standards.md).

## 6. Règles de sécurité (non négociables)

- **Jamais de secret dans le dépôt** : mots de passe, clés API, tokens, fichiers `.env`. Seul `.env.example` (valeurs factices) est versionné.
- Ne jamais afficher le contenu d'un `.env` dans une issue, une PR, un log ou un message.
- Aucune migration n'est appliquée sur une base partagée (staging, production) sans validation.
- Aucune donnée n'est supprimée et aucune base n'est réinitialisée sans accord explicite.
- Les décisions d'architecture validées ne sont pas remplacées sans un nouvel ADR approuvé.

## 7. Décisions d'architecture

Toute décision structurante (nouvelle technologie, changement de modèle, nouveau service) fait l'objet d'un ADR dans [docs/01-architecture/adr/](docs/01-architecture/adr/), à partir du modèle `0000-modele.md`.
