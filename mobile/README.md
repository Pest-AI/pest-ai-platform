# PEST AI OS — Application mobile

Application des **agents de terrain** et des **producteurs**. Elle parle à la même API que le Web OS, avec le même compte (numéro de téléphone + mot de passe).

**Technologies :** Expo SDK 58 (React Native 0.88, TypeScript strict), expo-router, expo-secure-store, NetInfo. Voir [ADR-0005](../docs/01-architecture/adr/0005-mobile-react-native-expo.md).

## Ce que fait la version actuelle (J10)

| Écran | Contenu |
|---|---|
| Connexion | Téléphone (+221) et mot de passe ; lien vers l'activation d'une invitation (Web OS) |
| Choix d'espace | Organisations actives, invitations à accepter, tirer pour actualiser |
| Accueil | Registre des producteurs de l'espace : recherche, pagination, appel direct |
| Fiche producteur | Identité, contacts (appel, WhatsApp), rattachement |

La console d'administration reste sur le Web OS. L'enregistrement de producteurs et la capture de parcelles arrivent avec le mode hors ligne (file SQLite).

## Sécurité

- **Jetons dans le trousseau du téléphone** (`expo-secure-store` : Keychain iOS, Keystore Android). Rien dans AsyncStorage ni dans les journaux.
- **Jeton d'accès de 15 min**, renouvelé une seule fois en cas de 401 (les requêtes simultanées partagent le même renouvellement). Si le renouvellement échoue, la session est effacée et l'écran de connexion revient.
- **Déconnexion** : le jeton de renouvellement est révoqué côté serveur (liste noire) ; la session locale est effacée même sans réseau. Confirmation demandée avant.
- **En-tête `X-Workspace`** sur chaque requête : l'API vérifie les droits dans l'espace choisi, l'app n'affiche que ce que l'API renvoie.
- **Aucun secret dans l'app** : seule l'adresse publique de l'API est configurée (`EXPO_PUBLIC_API_BASE_URL`). Tout ce qui est dans l'APK est lisible.
- Sauvegarde Android désactivée (`allowBackup: false`).
- Aperçu web (développement uniquement) : jetons en `sessionStorage`, effacés à la fermeture de l'onglet.

## Réseau

- Délai maximal de 20 s par requête, puis message « Connexion impossible ».
- Bandeau « Hors ligne » en bas de l'écran dès que le téléphone perd le réseau ; les données déjà affichées restent visibles.

## Démarrer

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

Le backend doit alors autoriser cette adresse (`DJANGO_ALLOWED_HOSTS`). Pour l'aperçu web, ajoutez `http://localhost:8081` à `CORS_ALLOWED_ORIGINS`.

## Vérifications (identiques à la CI)

```bash
npm run check:api    # types de l'API à jour (sinon : npm run gen:api)
npm run typecheck
npm test
```

> Le projet mobile utilise **npm** (et non pnpm comme le Web OS) : c'est l'outil recommandé par Expo pour React Native.

## Structure

```
app/                    écrans (expo-router)
  _layout.tsx           polices, session, bandeau hors ligne
  connexion.tsx · espaces.tsx · accueil.tsx · producteurs/[id].tsx
src/
  lib/api.ts            client HTTP (délai, renouvellement du jeton, erreurs typées)
  lib/storage.ts        trousseau sécurisé
  lib/session.tsx       état de session partagé
  lib/schema.d.ts       types générés depuis l'OpenAPI
  components/ui.tsx     composants de base (couleurs et polices du Web OS)
assets/brand/           logo et photos
```
