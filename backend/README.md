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
python manage.py runserver   # http://127.0.0.1:8000/api/v1/health/
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
├── tests/                   Tests transverses
├── requirements/            base.txt, dev.txt, production.txt
├── pyproject.toml           Configuration pytest, Ruff, Black
└── .env.example             Modèle de configuration locale
```

## Commandes utiles

| Commande | Usage |
|---|---|
| `python manage.py check` | Vérifier la configuration |
| `pytest` | Lancer les tests |
| `ruff check .` / `black .` | Lint / formatage |
| `python manage.py runserver` | Serveur local |

> Ne pas lancer `migrate` avant le J2 (modèle utilisateur personnalisé).
