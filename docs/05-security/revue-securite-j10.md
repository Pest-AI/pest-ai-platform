# Revue de sécurité — fin du sprint 2 (J10)

Périmètre : API Django, Web OS Next.js, app mobile Expo. Revue faite le 24/11/2026 sur le code du dépôt ; les contrôles marqués « CI » sont rejoués automatiquement.

## Ce qui est en place

### Authentification et session

| Point | Mesure |
|---|---|
| Mots de passe | Hachage Django (PBKDF2), validateurs de robustesse, jamais renvoyés par l'API |
| Jetons | JWT : accès 15 min, renouvellement 7 j avec rotation et liste noire |
| Web OS | Jetons en cookies `httpOnly`, `Secure` en production, `SameSite=Lax` ; jamais lisibles par le JavaScript de la page |
| Mobile | Jetons dans le trousseau du téléphone (`expo-secure-store`) ; sauvegarde Android désactivée |
| App terrain dans le navigateur (PWA) | Jeton de renouvellement en cookie `httpOnly`, `Secure`, `SameSite=Strict`, limité à `/api/v1/auth/web/` ; jeton d'accès en mémoire seulement ; contrôle de l'origine sur chaque route de session ; CSP sans script en ligne ; le service worker ne met jamais en cache `/api/` (J10b) |
| Déconnexion | Jeton de renouvellement révoqué côté serveur ; confirmation demandée à l'utilisateur |
| Activation | Code à usage unique, haché, 7 jours, 5 essais ; 20 tentatives par heure et par numéro |
| Tentatives de connexion | **Ajouté au J10** : 10 par minute et par numéro (`THROTTLE_AUTH_LOGIN`) ; l'activation passe aussi d'une limite par adresse IP (20 par heure pour tout le Web OS) à une limite par numéro, puis 429 avec `Retry-After` et message clair sur le Web OS et le mobile. Limite par numéro et non par adresse IP, car tout le Web OS passe par les mêmes serveurs Vercel |

### Autorisations

- Chaque requête métier porte `X-Workspace` ; `WorkspacePermission` vérifie l'adhésion active et la permission demandée (400 / 403 / 404).
- Les listes sont filtrées par organisation côté serveur : un producteur d'une autre organisation renvoie 404, jamais 403 (pas de fuite d'existence).
- Super-admin : accès justifié et journalisé.

### Web OS (en-têtes et formulaires)

| En-tête | Valeur |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`, images et connexions limitées aux tuiles de carte, `frame-ancestors 'none'`, `form-action 'self'`, `object-src 'none'` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | caméra, micro, géolocalisation désactivés |
| `Strict-Transport-Security` | en production |
| `X-Powered-By` | supprimé |

- **Routes de session** (`/api/session/login|logout|workspace`) : refus 403 si la requête vient d'un autre site (contrôle `Origin` / `Sec-Fetch-Site`). Les Server Actions de Next.js ont leur propre contrôle d'origine.
- Export CSV : cellules commençant par `=`, `+`, `-`, `@` neutralisées (injection de formules dans Excel).

### API (Django)

- `manage.py check --deploy --fail-level WARNING` passe en production (**CI**). Seul l'avertissement « HSTS preload » est neutralisé tant que le domaine n'est pas inscrit (`DJANGO_SECURE_HSTS_PRELOAD`).
- HTTPS forcé, cookies sécurisés, `SECURE_REFERRER_POLICY`, `SECURE_CROSS_ORIGIN_OPENER_POLICY`.
- CORS limité aux origines déclarées.
- Limitation de fréquence par numéro de téléphone sur la connexion et l'activation.

### Tests

- **Unitaires** : backend (pytest), Web OS (Vitest, dont l'origine des requêtes et l'échappement CSV), mobile (Jest : renouvellement du jeton, délai réseau, déconnexion hors ligne).
- **Bout en bout** (Playwright, `frontend/e2e`) : en-têtes de sécurité, redirection des pages protégées, refus des routes de session depuis un autre site, identifiants faux, code d'activation invalide, parcours connecté, déconnexion. Lancement manuel contre staging (workflow « E2E staging »).

## Points ouverts (avant la production)

| Point | Risque | Action prévue |
|---|---|---|
| CSP avec `'unsafe-inline'` pour les scripts | Réduit la protection contre l'injection de script | Passer aux nonces (Next.js `proxy`) avant l'ouverture au public |
| Fournisseur des tuiles satellite (Esri World Imagery) | Conditions d'usage | Choisir et contractualiser le fournisseur avant la production |
| OTP SMS (D-14) | Connexion par mot de passe seul | Second facteur par SMS au sprint dédié |
| Durées de conservation (D-27) | Données conservées sans limite | Fixer et automatiser la purge |
| Dépendances de l'outillage Expo | 3 vulnérabilités modérées (`minimatch`, via `@expo/fingerprint`), outil de build seulement, absentes de l'app installée | Suivre la prochaine version d'Expo |
| Compte de test E2E | Un compte réel sur staging | Compte dédié, rôle minimal, mot de passe en secret GitHub uniquement |
| Compteurs de limitation en mémoire locale | Sans cache partagé, chaque processus du serveur compte de son côté : la limite réelle est multipliée par le nombre de processus | Brancher un cache partagé (Redis ou base de données) avant la production |
| Inscription HSTS preload | — | Après stabilisation du domaine `pestai.africa` |
