# Apps Django de PEST AI OS

Chaque domaine métier est une app dans ce dossier (`apps/<nom>/`), ajoutée au fil du planning :

| App | Contenu | Jour prévu |
|---|---|---|
| [`core`](core/) | Mixins communs (BASE, ARCH, SYNC ; TENANT au J3, SPACE au J10), services d'archivage | J1 |
| `accounts` | Utilisateur personnalisé, authentification JWT | J2 |
| `organizations` | Organisations, adhésions, rôles | J3 |

Structure type d'une app :

```
apps/<nom>/
├── models.py        Modèles
├── services.py      Écritures et règles métier
├── selectors.py     Lectures et requêtes
├── serializers.py   Entrées / sorties API
├── views.py         Vues API (fines : elles appellent services et selectors)
├── urls.py
├── admin.py
└── tests/
```
