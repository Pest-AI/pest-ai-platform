---
sidebar_position: 7
title: Contribuer
---

# Contribuer

- Règles du projet : [`CONTRIBUTING.md`](https://github.com/Pest-AI/pest-ai-platform/blob/main/CONTRIBUTING.md)
- Workflow Git : [`docs/06-developer-guide/git-workflow.md`](https://github.com/Pest-AI/pest-ai-platform/blob/main/docs/06-developer-guide/git-workflow.md)
- Standards de code : [`docs/06-developer-guide/coding-standards.md`](https://github.com/Pest-AI/pest-ai-platform/blob/main/docs/06-developer-guide/coding-standards.md)
- Décisions d'architecture : [`docs/01-architecture/adr/`](https://github.com/Pest-AI/pest-ai-platform/tree/main/docs/01-architecture/adr)

## Mettre à jour la référence API

La référence de ce site lit `docs-site/static/openapi.yaml`, généré depuis le code du backend. Après toute modification d'une route :

```bash
make schema      # régénère docs-site/static/openapi.yaml
make verifier    # vérifie notamment que le schéma est à jour
```

La CI refuse un schéma qui ne correspond plus au code.

## Modifier ce site

Les pages sont en Markdown dans `docs-site/docs/`. Prévisualisation : `cd docs-site && pnpm start`.
