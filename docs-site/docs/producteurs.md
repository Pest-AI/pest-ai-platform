---
sidebar_position: 5
---

# Producteurs

Le registre des producteurs est **partagé** entre les organisations : une même personne n'a qu'une fiche, et chaque organisation qui la suit y est **rattachée** (`ProducerOrganizationAssignment`, historisé). Une organisation ne voit un producteur que si ce rattachement est **actif** ; sinon la fiche renvoie `404`.

## Deux situations

| | Cas A — inscrit par une organisation | Cas B — indépendant |
|---|---|---|
| Création | `POST /api/v1/producers/` (espace de l'organisation) | `POST /api/v1/me/producer/` (son propre compte) |
| Compte PEST AI | Facultatif | Obligatoire |
| Espace | `X-Workspace: org:<uuid>` | `X-Workspace: personal` |
| Modifiable par l'organisation | Oui (`producers.manage`) | Non : il gère lui-même son profil |

## Enregistrer un producteur

```http
POST /api/v1/producers/
X-Workspace: org:6f1c…

{
  "first_name": "Aïssatou",
  "last_name": "Diallo",
  "sex": "female",
  "birth_year": 1985,
  "locality_text": "Donaye",
  "phone_number": "+221775234412",
  "membership_number": "PDR-0042"
}
```

La réponse `201` contient la fiche, le téléphone principal, le rattachement actif (`assignment`) et son historique (`history`). Seule l'**année** de naissance est conservée (minimisation des données, D-08).

### Doublons probables (D-28)

Si le registre contient déjà le même téléphone, ou le même nom dans la même localité, l'API répond **`409`** avec des candidats réduits au minimum :

```json
{
  "detail": "Ce producteur semble déjà enregistré.",
  "candidates": [
    { "id": "…", "display_name": "Oumar T.", "locality": "Dagana", "phone_hint": "•• 64",
      "in_organization": false, "can_attach": true }
  ]
}
```

- `can_attach: true` : rattacher la fiche existante avec `POST /api/v1/producers/attach/` (`producer_id`).
- Personne différente : renvoyer la demande avec `"confirm_new": true`.
- Un producteur **indépendant** ne peut pas être rattaché par une organisation seule : son accord sera nécessaire.

## Autres routes

| Route | Permission | Effet |
|---|---|---|
| `GET /api/v1/producers/?q=` | `producers.view` | Liste, recherche sur nom, localité, téléphone, n° d'adhérent |
| `GET /api/v1/producers/{id}/` | `producers.view` | Fiche |
| `PATCH /api/v1/producers/{id}/` | `producers.manage` | Fiche, téléphone principal, type de relation, n° d'adhérent |
| `POST /api/v1/producers/{id}/detach/` | `producers.manage` | Clôt le rattachement (rien n'est supprimé) ; retire le rôle `producer` |
| `GET /api/v1/workspace/` | — | Rôles et permissions du compte dans l'espace demandé |

Le détail de chaque champ est dans la **Référence API** (menu du haut).
