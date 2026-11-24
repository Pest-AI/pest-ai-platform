# PEST AI Terrain — application mobile

Application des **agents de terrain** et des **producteurs**. Elle parle à la même API que le Web OS, avec le même compte (numéro de téléphone + mot de passe).

Un seul code, deux façons de la distribuer ([ADR-0009](../docs/01-architecture/adr/0009-app-terrain-pwa-d-abord.md)) :
- **d'abord en PWA** sur **`terrain.pestai.africa`** : un lien à ouvrir dans le navigateur du téléphone, puis « Ajouter à l'écran d'accueil » ;
- **ensuite sur les stores** (APK, Play Store, puis App Store), à partir du même code.

**Technologies :** Expo SDK 58 (React Native 0.88, TypeScript strict), expo-router, expo-secure-store, NetInfo. Voir [ADR-0005](../docs/01-architecture/adr/0005-mobile-react-native-expo.md).

## Ce que fait la version actuelle (J10)

| Écran | Contenu |
|---|---|
| Connexion | Téléphone (+221) et mot de passe ; lien vers l'activation d'une invitation (Web OS) |
| Choix d'espace | Organisations actives, invitations à accepter, tirer pour actualiser |
| Parcelles (accueil, J15) | Parcelles de l'espace **consultables hors ligne** : liste, carte vectorielle (sans fond satellite), recherche par AgroID (saisie tolérée), nom ou exploitant, tri par distance avec « Ma position », date de la dernière mise à jour |
| Fiche parcelle | AgroID, statut, surface, contour, itinéraire Google Maps, contrôle du contour, exploitant et propriété (avec le réseau) |
| Producteurs | Registre des producteurs de l'espace : recherche, pagination, appel direct |
| Fiche producteur | Identité, contacts (appel, WhatsApp), rattachement |

La console d'administration reste sur le Web OS. L'enregistrement de producteurs et la capture de parcelles arrivent avec le mode hors ligne (file SQLite).

## Sécurité

- **Jetons dans le trousseau du téléphone** (`expo-secure-store` : Keychain iOS, Keystore Android). Rien dans AsyncStorage ni dans les journaux.
- **Jeton d'accès de 15 min**, renouvelé une seule fois en cas de 401 (les requêtes simultanées partagent le même renouvellement). Si le renouvellement échoue, la session est effacée et l'écran de connexion revient.
- **Déconnexion** : le jeton de renouvellement est révoqué côté serveur (liste noire) ; la session locale est effacée même sans réseau. Confirmation demandée avant.
- **En-tête `X-Workspace`** sur chaque requête : l'API vérifie les droits dans l'espace choisi, l'app n'affiche que ce que l'API renvoie.
- **Aucun secret dans l'app** : seule l'adresse publique de l'API est configurée (`EXPO_PUBLIC_API_BASE_URL`). Tout ce qui est dans l'APK est lisible.
- Sauvegarde Android désactivée (`allowBackup: false`).
- **Dans le navigateur (PWA)** : pas de coffre sécurisé, donc le jeton de renouvellement est un cookie `httpOnly` posé par l'API (`/api/v1/auth/web/…`, `SameSite=Strict`), illisible par la page. Seul le jeton d'accès (15 min) est gardé, en mémoire ; au rechargement, il est redemandé avec le cookie. Chaque route de session vérifie l'origine de la requête.
- PWA : en-têtes de sécurité stricts (CSP sans script en ligne, anti-iframe, HSTS) dans `vercel.json` ; le service worker ne met jamais en cache les appels à l'API.

## Hors ligne (lecture)

- À chaque ouverture avec du réseau (et si la copie a plus de 10 minutes), l'app télécharge les parcelles de l'espace (contours et liste, 1 000 au plus) et les garde sur l'appareil, avec la date de mise à jour.
- Sans réseau, la liste, la carte, la recherche et la fiche fonctionnent sur cette copie ; un bandeau indique l'âge des données.
- Navigateur (PWA) : IndexedDB (base `pestai-terrain`). Téléphone : en mémoire pour l'instant, base SQLite avec la synchronisation (J18).
- La copie est **effacée à la déconnexion**.

## Réseau

- Délai maximal de 20 s par requête, puis message « Connexion impossible ».
- Bandeau « Hors ligne » en bas de l'écran dès que le téléphone perd le réseau ; les données déjà affichées restent visibles.

## PWA (`terrain.pestai.africa`)

- `public/` : page d'accueil HTML (`index.html`), manifeste, icônes, service worker (`sw.js`) ;
- `vercel.json` : build, relais `/api/…` vers l'API (même origine), en-têtes de sécurité ;
- l'app propose de s'installer : bouton sur Android (Chrome), explication sur iPhone (Safari) ;
- hors ligne, l'app s'ouvre quand même (écrans en cache) et affiche le bandeau « Hors ligne ».

Tester la version publiée en local, à l'identique de Vercel :

```bash
npm run web:build                 # construit dist/
npm run web:preview               # http://localhost:4173, API locale (make serveur)
API_TARGET=https://api-staging.pestai.africa npm run web:preview   # contre le staging
```

Contre le staging, la connexion n'aboutit que si `http://localhost:4173` figure dans `WEB_SESSION_ALLOWED_ORIGINS` du staging ; sinon testez contre l'API locale. Depuis un téléphone sur le même Wi-Fi : `http://<ip-du-mac>:4173`, en ajoutant cette adresse aux origines autorisées de votre `.env`.

## Démarrer (app native, Expo Go)

```bash
cd mobile
npm ci
npm start            # QR code pour Expo Go (Android/iOS)
npm run web          # aperçu dans le navigateur
```

Par défaut l'app vise l'API de staging. Pour viser le backend local depuis un téléphone sur le même Wi-Fi :

```bash
EXPO_PUBLIC_API_BASE_URL=http://<ip-de-votre-pc>:8000 npm start
```

Le backend doit alors autoriser cette adresse (`DJANGO_ALLOWED_HOSTS`) et écouter sur le réseau (`runserver 0.0.0.0:8000`).

Sur iPhone, Expo Go demande d'être connecté au même compte Expo que le Mac (`npx expo login`).

## Vérifications (identiques à la CI)

```bash
npm run check:api    # types de l'API à jour (sinon : npm run gen:api)
npm run typecheck
npm test
npm run web:build    # la version PWA se construit
```

> Le projet mobile utilise **npm** (et non pnpm comme le Web OS) : c'est l'outil recommandé par Expo pour React Native.

## Structure

```
app/                    écrans (expo-router)
  _layout.tsx           polices, session, bandeau hors ligne
  connexion.tsx · espaces.tsx · accueil.tsx · producteurs/[id].tsx
src/
  lib/api.ts            client HTTP (délai, renouvellement du jeton, erreurs typées)
  lib/storage.ts        trousseau sécurisé (téléphone) ou mémoire (navigateur)
  lib/pwa.ts            service worker, proposition d'installation
  lib/session.tsx       état de session partagé
  lib/schema.d.ts       types générés depuis l'OpenAPI
  components/ui.tsx     composants de base (couleurs et polices du Web OS)
assets/brand/           logo et photos
public/                 fichiers de la PWA (index.html, manifeste, icônes, sw.js)
scripts/preview-web.mjs aperçu local de la PWA (comme Vercel)
vercel.json             publication sur terrain.pestai.africa
```
