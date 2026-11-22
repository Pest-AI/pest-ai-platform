# Commandes courantes de PEST AI OS.
# Usage : make <commande>   (depuis la racine du dépôt)
# La liste des commandes : make aide

VENV ?= backend/.venv
BIN := $(abspath $(VENV))/bin

.DEFAULT_GOAL := aide
.PHONY: aide verifier qualite migrations-ok tests serveur formater installer

aide: ## Affiche cette aide
	@echo "Commandes disponibles :"
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-14s %s\n", $$1, $$2}'

verifier: qualite migrations-ok tests ## Lance TOUS les contrôles avant un commit
	@echo ""
	@echo "Tout est vert : vous pouvez commiter et pousser."

qualite: ## Ruff, Black et contrôles de sécurité (pre-commit)
	cd backend && $(BIN)/ruff check . && $(BIN)/black --check .
	$(BIN)/pre-commit run --all-files

migrations-ok: ## Vérifie la configuration Django et qu'aucune migration ne manque
	cd backend && $(BIN)/python manage.py check
	cd backend && $(BIN)/python manage.py makemigrations --check --dry-run

tests: ## Lance les tests backend (pytest)
	cd backend && $(BIN)/pytest

serveur: ## Démarre le serveur local sur http://127.0.0.1:8000
	cd backend && $(BIN)/python manage.py runserver

formater: ## Corrige automatiquement le format du code backend
	cd backend && $(BIN)/ruff check --fix . && $(BIN)/black .

installer: ## (Ré)installe les dépendances backend dans le venv
	$(BIN)/pip install --retries 10 --timeout 60 -r backend/requirements/dev.txt
