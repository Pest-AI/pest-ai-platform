# Workflow Git

Résumé du cycle de travail. Les règles de nommage sont dans [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Cycle d'une tâche

```bash
# 1. Partir de main à jour
git switch main
git pull

# 2. Créer la branche de la tâche
git switch -c feat/nom-de-la-tache

# 3. Travailler, puis vérifier
cd backend && pytest && cd ..
pre-commit run --all-files

# 4. Commiter (pre-commit s'exécute automatiquement)
git add <fichiers>
git commit -m "feat(portee): resume du changement"

# 5. Pousser et ouvrir la pull request
git push -u origin feat/nom-de-la-tache
gh pr create --fill

# 6. Après validation : squash merge sur GitHub, puis nettoyage local
git switch main
git pull
git branch -d feat/nom-de-la-tache
```

## Si pre-commit modifie des fichiers

Ruff, Black ou les contrôles de fin de ligne peuvent corriger des fichiers pendant le commit. Le commit est alors interrompu : il suffit de refaire `git add` sur les fichiers corrigés puis `git commit`.

## Versions

Chaque fin de semaine du planning donne lieu à une version taguée sur `main` : `v0.0.1`, `v0.0.2`… jusqu'à `v0.1.0` (livraison du MVP).

```bash
git tag -a v0.0.1 -m "Semaine 1 : socle backend"
git push origin v0.0.1
```
