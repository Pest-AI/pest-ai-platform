# PEST AI OS — Backend (API)

API centrale de PEST AI OS : Django 5.2 LTS, Django REST Framework, PostgreSQL 16 + PostGIS.

## Démarrer

Guide complet : [installation-mac.md](../docs/06-developer-guide/installation-mac.md).

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements/dev.txt
cp .env.example .env    # compléter les valeurs
python manage.py check
pytest
python manage.py migrate
python manage.py createsuperuser   # compte technique (numéro de téléphone)
python manage.py runserver         # http://127.0.0.1:8000/api/v1/health/
```

## Structure

```
backend/
├── config/
│   ├── settings/
│   │   ├── base.py          Paramètres communs
│   │   ├── development.py   Développement local
│   │   ├── test.py          Tests (pytest, CI)
│   │   └── production.py    Staging et production (Render)
│   ├── urls.py              Routes (/api/v1/…)
│   └── views.py             Vues techniques (santé)
├── apps/                    Apps métier (core, accounts, organizations…)
├── tests/                   Tests transverses (+ testapp : modèles de test des mixins)
├── requirements/            base.txt, dev.txt, production.txt
├── pyproject.toml           Configuration pytest, Ruff, Black
└── .env.example             Modèle de configuration locale
```

## Commandes utiles (depuis la racine du dépôt)

| Commande | Usage |
|---|---|
| `make verifier` | Tous les contrôles avant un commit (qualité, migrations, tests) |
| `make tests` | Lancer les tests |
| `make serveur` | Serveur local |
| `make formater` | Corriger le format du code |
| `make aide` | Liste des commandes |
