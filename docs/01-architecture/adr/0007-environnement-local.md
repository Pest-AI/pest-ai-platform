# 0007 — Environnement local : Postgres.app et bibliothèques GDAL configurables

- **Statut :** Accepté
- **Date :** 22/11/2026
- **Décideurs :** Thierno Bocar Dieng (CEO)

## Contexte

GeoDjango a besoin de GDAL et GEOS. Sur macOS, l'installation de GDAL par Homebrew télécharge plus de 100 dépendances (3 à 4 Go), ce qui échoue souvent sur une connexion instable. Postgres.app, déjà utilisé pour la base locale, fournit PostgreSQL 16, PostGIS, GDAL, GEOS et PROJ.

## Décision

- Base locale : **Postgres.app** (PostgreSQL 16 + PostGIS). Docker sert à tester l'image de production.
- Chemins des bibliothèques géographiques **configurables** dans `.env` (`GDAL_LIBRARY_PATH`, `GEOS_LIBRARY_PATH`) : Postgres.app (option A) ou Homebrew (option B).
- L'avertissement Django `gis.W001` (GDAL < 3.9 ne bloque pas certains accès fichiers et réseau) est **masqué en développement et en test uniquement**. La production utilise une image Docker avec GDAL ≥ 3.9 et ne le masque pas.

## Options écartées

- **Homebrew obligatoire :** bloquant avec une connexion instable.
- **Développement entièrement dans Docker :** plus lourd au quotidien sur un MacBook.

## Conséquences

- Positives : installation rapide, pas de téléchargement lourd.
- Négatives : GDAL 3.7 en local, différent de la production. Les tests de bout en bout se font aussi sur staging.
- Actions : passer à GDAL Homebrew (≥ 3.9) quand la connexion le permet, en modifiant deux lignes de `.env`.
