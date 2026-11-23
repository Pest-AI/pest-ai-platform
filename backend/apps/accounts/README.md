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
| POST | `/api/v1/auth/activate/` | Activer un compte créé par invitation : numéro + code + mot de passe choisi | Non (limité à 20/h par adresse) |

Exemples : [docs-site/docs/authentification.md](../../../docs-site/docs/authentification.md).

## Comptes créés par invitation (`AccountActivation`)

Quand un gérant invite un numéro sans compte, le compte est créé **sans mot de passe** et un code d'activation est émis (`apps/accounts/activation.py`) :

- 8 caractères (alphabet Crockford, sans I, L, O, U), affichés `ABCD-EF12` ; saisie tolérante (minuscules, tirets, O→0, I/L→1) ;
- seule une empreinte HMAC-SHA256 (clé `SECRET_KEY`) est stockée, jamais le code ;
- valable 7 jours, à usage unique, annulé après 5 essais erronés ; un nouveau code annule les précédents ;
- message d'erreur identique quel que soit le motif (numéro inconnu, code faux ou expiré) ;
- événements journalisés : `account_activation` (`code_issued`, `refused`, `activated`).

Remplacé par l'envoi automatique d'un SMS quand la vérification OTP (D-14) sera livrée.

## Durée de vie des jetons

Jeton d'accès : 15 minutes. Jeton de rafraîchissement : 7 jours, renouvelé à chaque usage. Réglables par `JWT_ACCESS_TOKEN_MINUTES` et `JWT_REFRESH_TOKEN_DAYS`.

## À venir

- Vérification du numéro par code SMS (OTP, décision D-14) avant toute écriture.
- Limitation du nombre de tentatives de connexion (J26).
