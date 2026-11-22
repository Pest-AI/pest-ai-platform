# Workflow Git

Les règles complètes sont dans [CONTRIBUTING.md](../../CONTRIBUTING.md) : le projet est en **phase 1 (développement solo)**, on travaille directement sur `main`.

## Routine quotidienne (phase 1)

```bash
cd ~/Documents/pest-ai-platform
git pull                       # récupérer la dernière version

# … travailler (ou intégrer le lot du jour) …

make verifier                  # qualité + migrations + tests
git add -A
git status --short             # relire : aucun .env, aucun .venv
git commit -m "type(portee): resume du changement"
git push
```

Après le push, l'onglet **Actions** du dépôt GitHub montre le résultat de la CI (coche verte ou croix rouge).

## Si pre-commit modifie des fichiers

Ruff, Black ou les contrôles de fin de ligne peuvent corriger des fichiers pendant le commit. Le commit est alors interrompu : refaire `git add -A` puis `git commit`.

## Si la CI échoue après un push

1. Ouvrir l'onglet **Actions** sur GitHub, cliquer sur l'exécution en rouge et lire l'étape en échec.
2. Corriger en local, relancer `make verifier`, commiter et pousser.

## Phase 2 (équipe) : branches et pull requests

```bash
git switch main && git pull
git switch -c feat/nom-de-la-tache
# … travailler, make verifier, commits …
git push -u origin feat/nom-de-la-tache
gh pr create --fill
# après CI verte et relecture : squash merge sur GitHub
git switch main && git pull && git branch -d feat/nom-de-la-tache
```

## Versions

Chaque fin de semaine du planning donne lieu à une version taguée sur `main` : `v0.0.1`, `v0.0.2`… jusqu'à `v0.1.0` (livraison du MVP).

```bash
git tag -a v0.0.1 -m "Semaine 1 : socle backend"
git push origin v0.0.1
```
