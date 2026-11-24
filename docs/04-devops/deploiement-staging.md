# Déploiement du staging (Render + Vercel)

| Élément | Hébergement | Adresse |
|---|---|---|
| API de staging | Render (Docker, Francfort) | `https://api-staging.pestai.africa` (+ `https://pestai-api-staging.onrender.com`) |
| Base de données | Render PostgreSQL 16 Basic (PostGIS) | interne à Render |
| Portail développeurs | Vercel | `https://docs.pestai.africa` |

Toute l'infrastructure Render est décrite dans [`render.yaml`](../../render.yaml) (Blueprint) ; l'image dans [`infrastructure/backend/Dockerfile`](../../infrastructure/backend/Dockerfile).

## 1. API sur Render

1. Créer un compte sur [render.com](https://render.com) **avec le compte GitHub** et autoriser l'accès au dépôt `Pest-AI/pest-ai-platform`.
2. **New → Blueprint**, choisir le dépôt, branche `main`. Render lit `render.yaml` et propose : la base `pestai-staging-db` et le service `pestai-api-staging`.
3. Renseigner les valeurs demandées (jamais commitées) :
   - `INITIAL_ADMIN_PHONE` : numéro du compte d'administration (`+221…`) ;
   - `INITIAL_ADMIN_PASSWORD` : mot de passe **fort et différent** de celui du poste local ;
   - `INITIAL_ADMIN_FIRST_NAME`, `INITIAL_ADMIN_LAST_NAME`.
4. Ajouter un moyen de paiement (la base Basic est payante, environ 6 $/mois) et cliquer **Apply**.
5. Attendre la fin du premier déploiement (5 à 10 minutes : construction de l'image, migrations, création du compte).
6. Vérifier : `https://pestai-api-staging.onrender.com/api/v1/health/` doit renvoyer `"environment": "staging"`.

**Au démarrage, le conteneur** applique les migrations (les 7 rôles se chargent), crée le compte d'administration initial s'il n'existe pas (avec le rôle `super_admin` pour 90 jours), puis lance gunicorn. Voir [`backend/entrypoint.sh`](../../backend/entrypoint.sh).

**Déploiements suivants** : automatiques à chaque push sur `main` qui touche `backend/` ou `infrastructure/backend/`, **seulement si la CI est verte** (`autoDeployTrigger: checksPass`).

**Offre gratuite de l'API** : le service s'endort après 15 minutes sans requête ; la requête suivante attend environ une minute. Normal en staging.

## 2. Portail développeurs sur Vercel

1. Créer un compte sur [vercel.com](https://vercel.com) avec le compte GitHub.
2. **Add New → Project**, importer `Pest-AI/pest-ai-platform`.
3. **Root Directory : `docs-site`**. Le reste est lu dans [`docs-site/vercel.json`](../../docs-site/vercel.json). Cliquer **Deploy**.
4. Vérifier l'adresse `….vercel.app` fournie par Vercel.

Chaque push sur `main` qui touche `docs-site/` redéploie le site.

## 2 bis. App terrain (PWA) sur Vercel

L'app terrain (`mobile/`) est publiée comme site web installable sur `terrain.pestai.africa` ([ADR-0009](../01-architecture/adr/0009-app-terrain-pwa-d-abord.md)).

1. Vercel : **Add New → Project**, importer de nouveau `Pest-AI/pest-ai-platform`.
2. Nom du projet : `pestai-terrain`. **Root Directory : `mobile`**. Le reste est lu dans [`mobile/vercel.json`](../../mobile/vercel.json) : installation `npm ci`, build `expo export --platform web`, dossier `dist`, relais de `/api/…` vers l'API de staging, en-têtes de sécurité. Aucune variable d'environnement à saisir. Cliquer **Deploy**.
3. Render : vérifier que la variable `WEB_SESSION_ALLOWED_ORIGINS` du service API vaut `https://terrain.pestai.africa` (ajoutée au Blueprint ; sinon **Environment → Add**), puis redéployer l'API.
4. Domaine : projet `pestai-terrain` → **Settings → Domains → Add** `terrain.pestai.africa`, et le CNAME chez GoDaddy (tableau ci-dessous).

Contrôle après déploiement : ouvrir `https://terrain.pestai.africa` sur un téléphone, se connecter, recharger la page (la session doit rester ouverte), puis se déconnecter.

## 3. Sous-domaines pestai.africa

Chez le gestionnaire DNS de `pestai.africa` (voir `dig NS pestai.africa +short`), ajouter :

| Type | Nom | Valeur |
|---|---|---|
| CNAME | `api-staging` | `pestai-api-staging.onrender.com` (valeur exacte affichée par Render) |
| CNAME | `docs` | valeur affichée par Vercel (en général `cname.vercel-dns.com`) |
| CNAME | `terrain` | valeur affichée par Vercel pour le projet `pestai-terrain` |

Puis déclarer chaque domaine côté hébergeur :

- Render : service `pestai-api-staging` → **Settings → Custom Domains → Add** `api-staging.pestai.africa` → **Verify** ;
- Vercel : projet → **Settings → Domains → Add** `docs.pestai.africa`.

Les certificats HTTPS sont émis automatiquement après vérification (quelques minutes à quelques heures selon la propagation DNS).

## 4. Vérifications finales

```bash
curl https://api-staging.pestai.africa/api/v1/health/
```

- Référence interactive du staging : `https://api-staging.pestai.africa/api/docs/`
- Console d'administration : `https://api-staging.pestai.africa/admin/`
- Portail : `https://docs.pestai.africa` → **Référence API** → serveur « Staging ».

## Variables d'environnement du service

| Variable | Origine | Rôle |
|---|---|---|
| `DATABASE_URL` | Render (base liée) | Connexion PostgreSQL ; le moteur PostGIS est imposé par les réglages |
| `DJANGO_SECRET_KEY` | Générée par Render | Clé secrète Django |
| `PEST_AI_ENVIRONMENT` | `render.yaml` | `staging` (affiché par `/api/v1/health/`) |
| `DJANGO_ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS` | `render.yaml` | Domaine personnalisé (le domaine `….onrender.com` est ajouté automatiquement) |
| `CORS_ALLOWED_ORIGINS` | `render.yaml` | Origines autorisées à appeler l'API depuis un navigateur |
| `WEB_SESSION_ALLOWED_ORIGINS` | `render.yaml` | Origines de l'app terrain autorisées à ouvrir une session par cookie |
| `INITIAL_ADMIN_*` | Tableau de bord Render | Compte d'administration initial |
