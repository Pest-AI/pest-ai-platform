# Décisions d'architecture (ADR)

Un ADR (*Architecture Decision Record*) documente une décision structurante : le contexte, le choix, et ses conséquences. Il permet à un nouveau développeur de comprendre **pourquoi** le projet est construit ainsi.

| N° | Décision | Statut | Date |
|---|---|---|---|
| [0001](0001-monorepo.md) | Monorepo unique `pest-ai-platform` | Accepté | 22/11/2026 |
| [0002](0002-backend-django-postgis.md) | Backend Django 5.2 LTS + DRF + PostgreSQL 16/PostGIS | Accepté | 22/11/2026 |
| [0003](0003-hebergement-render-vercel.md) | Hébergement Render (Docker) et Vercel, fichiers sur Cloudflare R2 | Accepté | 22/11/2026 |
| [0004](0004-frontend-nextjs.md) | Web OS en Next.js avec espaces par rôle | Accepté | 22/11/2026 |
| [0005](0005-mobile-react-native-expo.md) | Application mobile React Native (Expo) à la place de la PWA | Accepté | 22/11/2026 |
| [0006](0006-documentation-api.md) | Documentation API : OpenAPI + Docusaurus + Scalar | Accepté | 22/11/2026 |
| [0007](0007-environnement-local.md) | Environnement local : Postgres.app, bibliothèques GDAL configurables | Accepté | 22/11/2026 |
| [0008](0008-session-web-cookies-httponly.md) | Session du Web OS : jetons en cookies httpOnly via le serveur Next.js | Accepté | 23/11/2026 |
| [0009](0009-app-terrain-pwa-d-abord.md) | App terrain publiée d'abord en PWA (`terrain.pestai.africa`), puis sur les stores, même code | Accepté | 24/11/2026 |

## Créer un ADR

1. Copier [0000-modele.md](0000-modele.md) en `NNNN-titre-court.md` (numéro suivant).
2. Le remplir et l'ajouter à ce tableau.
3. L'ouvrir en pull request : la décision est acceptée quand la PR est fusionnée.

Un ADR accepté n'est jamais modifié sur le fond : s'il est remplacé, un nouvel ADR le remplace et l'ancien passe au statut « Remplacé par NNNN ».
