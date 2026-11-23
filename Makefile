# Commandes courantes de PEST AI OS.
# Usage : make <commande>   (depuis la racine du dépôt)
# La liste des commandes : make aide

VENV ?= backend/.venv
BIN := $(abspath $(VENV))/bin

.DEFAULT_GOAL := aide
.PHONY: aide verifier qualite migrations-ok schema-ok tests serveur formater installer schema docs web web-verifier api-types

aide: ## Affiche cette aide
	@echo "Commandes disponibles :"
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-14s %s\n", $$1, $$2}'

verifier: qualite migrations-ok schema-ok tests ## Lance TOUS les contrôles avant un commit
	@echo ""
	@echo "Tout est vert : vous pouvez commiter et pousser."

qualite: ## Ruff, Black et contrôles de sécurité (pre-commit)
	cd backend && $(BIN)/ruff check . && $(BIN)/black --check .
	$(BIN)/pre-commit run --all-files

migrations-ok: ## Vérifie la configuration Django et qu'aucune migration ne manque
	cd backend && $(BIN)/python manage.py check
	cd backend && $(BIN)/python manage.py makemigrations --check --dry-run

schema-ok: ## Vérifie que la référence API (docs-site) correspond au code
	@cd backend && $(BIN)/python manage.py spectacular --validate --fail-on-warn --file /tmp/pestai-openapi.yaml
	@diff -q /tmp/pestai-openapi.yaml docs-site/static/openapi.yaml >/dev/null \
		|| (echo "La référence API n'est plus à jour : lancez « make schema »." && exit 1)
	@echo "Référence API à jour."

schema: ## Régénère la référence API (docs-site/static/openapi.yaml)
	cd backend && $(BIN)/python manage.py spectacular --validate --fail-on-warn --file ../docs-site/static/openapi.yaml

web: ## Lance le Web OS sur http://localhost:3000 (API locale requise : make serveur)
	cd frontend && pnpm install && pnpm dev

web-verifier: ## Contrôles du Web OS : types API à jour, lint, types, tests
	cd frontend && pnpm check:api && pnpm lint && pnpm typecheck && pnpm test

api-types: ## Régénère la référence API puis les types TypeScript du Web OS
	$(MAKE) schema
	cd frontend && pnpm gen:api

docs: ## Lance le site de documentation sur http://localhost:3001
	cd docs-site && pnpm install && pnpm start --port 3001

tests: ## Lance les tests backend (pytest)
	cd backend && $(BIN)/pytest

serveur: ## Démarre le serveur local sur http://127.0.0.1:8000
	cd backend && $(BIN)/python manage.py runserver

formater: ## Corrige automatiquement le format du code backend
	cd backend && $(BIN)/ruff check --fix . && $(BIN)/black .

installer: ## (Ré)installe les dépendances backend dans le venv
	$(BIN)/pip install --retries 10 --timeout 60 -r backend/requirements/dev.txt
