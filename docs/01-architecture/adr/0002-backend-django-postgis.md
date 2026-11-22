# 0002 — Backend Django 5.2 LTS + DRF + PostgreSQL 16 / PostGIS

- **Statut :** Accepté
- **Date :** 22/11/2026
- **Décideurs :** Thierno Bocar Dieng (CEO)

## Contexte

Le cœur métier est géographique (parcelles, contours GPS, AgroID) et multi-organisation, avec un modèle de données riche défini dans le Database Design v2.2 (contraintes composites, déclencheurs, colonnes générées).

## Décision

- **Django 5.2 LTS** (support de sécurité jusqu'en avril 2028) avec **Django REST Framework**.
- **PostgreSQL 16 + PostGIS** via GeoDjango.
- Authentification JWT (SimpleJWT), mots de passe hachés en **PBKDF2**.
- Tâches asynchrones avec Celery + Redis (à partir du J23).
- Paramètres découpés par environnement (`base`, `development`, `test`, `production`), configuration par variables d'environnement (django-environ).

## Options écartées

- **Django 6.x :** pas encore LTS ; on privilégie la stabilité pour le MVP.
- **FastAPI :** pas d'ORM géographique ni d'administration intégrés équivalents.

## Conséquences

- Positives : GeoDjango, admin Django, écosystème mature, intégrité en base.
- Négatives : GDAL et GEOS doivent être disponibles sur chaque machine et dans l'image Docker.
- Actions : passage à la prochaine LTS de Django avant la fin du support de la 5.2.
