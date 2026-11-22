# App `accounts` — comptes et authentification

## Modèle `User` (Database Design v2.2)

- **Identifiant de connexion : le numéro de téléphone**, au format international E.164 (`+221771234567`). Les espaces, tirets et le préfixe `00` sont normalisés automatiquement.
- **E-mail facultatif**, unique s'il est renseigné (sans tenir compte des majuscules). Absent = `NULL`.
- **Langue préférée** : `fr` (défaut), `wo`, `ff`.
- **Mots de passe** hachés en PBKDF2, jamais stockés en clair.
- **Aucun rôle métier** sur le User : les rôles passent par les adhésions aux organisations (J3).
- **Pas de suppression** : un compte se désactive (`is_active=False`).
- `is_staff` / `is_superuser` : accès technique à la console Django, réservé à l'équipe PEST AI. Ce n'est pas le rôle métier `super_admin`.

## API

| Méthode | Route | Rôle | Authentification |
|---|---|---|---|
| POST | `/api/v1/auth/token/` | Connexion : renvoie `access` et `refresh` | Non |
| POST | `/api/v1/auth/token/refresh/` | Nouveau jeton d'accès (et nouveau `refresh`, l'ancien est invalidé) | Non |
| POST | `/api/v1/auth/logout/` | Déconnexion : invalide le jeton `refresh` | Non |
| GET | `/api/v1/me/` | Profil de l'utilisateur connecté | Jeton d'accès |
| PATCH | `/api/v1/me/` | Modifier prénom, nom, e-mail, langue | Jeton d'accès |
| POST | `/api/v1/me/password/` | Changer son mot de passe | Jeton d'accès |

Exemples : [docs/03-api/authentification.md](../../../docs/03-api/authentification.md).

## Durée de vie des jetons

Jeton d'accès : 15 minutes. Jeton de rafraîchissement : 7 jours, renouvelé à chaque usage. Réglables par `JWT_ACCESS_TOKEN_MINUTES` et `JWT_REFRESH_TOKEN_DAYS`.

## À venir

- Vérification du numéro par code SMS (OTP, décision D-14) avant toute écriture.
- Limitation du nombre de tentatives de connexion (J26).
