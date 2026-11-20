# PEST AI OS — Global Architecture

**Version:** 1.0  
**Statut:** Draft — Architecture cible  
**Projet:** PEST AI OS  
**Organisation:** ECLIPTIX SAS  
**Nature:** Plateforme d'intelligence agricole et infrastructure numérique

---

## 1. Vision et objectif

PEST AI OS est une infrastructure numérique d'intelligence agricole destinée à digitaliser, analyser, suivre et valoriser les activités agricoles.

Son objectif est de transformer chaque parcelle agricole en une identité numérique traçable et exploitable, en combinant :

- Données collectées sur le terrain.
- Données géospatiales et satellitaires.
- Images aériennes et données de drones.
- Données météorologiques et environnementales.
- Intelligence artificielle et modèles agronomiques.
- Historique des pratiques et performances agricoles.
- Données économiques et indicateurs de fiabilité.

PEST AI OS doit évoluer vers une infrastructure interconnectée capable de servir les producteurs, coopératives, agronomes, institutions, ONG, entreprises agricoles, banques et assurances.

**Principe directeur :** concevoir une plateforme globale dès le départ et développer ses capacités progressivement par phases.

## 2. Principes architecturaux

L'architecture repose sur les principes suivants :

1. Architecture globale et évolutive.
2. Modular Monolith pour le backend initial.
3. API-first pour les communications entre les interfaces et les services.
4. Multi-tenant / multi-organisation avec isolation des données.
5. Offline-first pour les opérations terrain.
6. Géospatial natif avec PostgreSQL et PostGIS.
7. Architecture IA indépendante des interfaces.
8. Centralisation et traçabilité des données agricoles.
9. Sécurité et contrôle d'accès à chaque couche.
10. Évolutivité vers des services indépendants lorsque les besoins le justifient.

L'objectif n'est pas de créer prématurément des microservices, mais de conserver des frontières métier claires.

## 3. Architecture fonctionnelle globale

La plateforme comprend les domaines suivants.

### 3.1 Identity & Access Management

Responsabilités :
- Authentification.
- Gestion des utilisateurs.
- Gestion des organisations.
- Rôles et permissions.
- Appartenance à plusieurs organisations.
- Gestion des sessions et appareils.
- Contrôle d'accès aux ressources.

### 3.2 Producer & Organization Management

Responsabilités :
- Profils producteurs.
- Coopératives et organisations.
- Rattachement des producteurs.
- Gestion des agents terrain.
- Profils agronomes.
- Historique des affiliations.

### 3.3 AgroID & Parcel Management

AgroID constitue le socle de l'identité agricole numérique.

Responsabilités :
- Identifiant numérique unique de chaque parcelle.
- Géométrie et superficie.
- Localisation administrative et agroécologique.
- Historique des exploitants.
- Informations foncières disponibles.
- Unités de culture.
- Historique des changements.

La parcelle constitue un objet central auquel peuvent être associés les cycles agricoles, observations, diagnostics, données satellitaires et historiques de performance.

### 3.4 Agricultural Management

Responsabilités :
- Campagnes agricoles.
- Cultures et variétés.
- Cycles culturaux.
- Stades de développement.
- Calendriers agricoles.
- Pratiques culturales.
- Activités et interventions.
- Historique de production et de rendement.

### 3.5 Field Operations

Responsabilités :
- Planification des missions.
- Affectation des agents.
- Organisation des visites.
- Collecte des observations.
- Rapports terrain.
- Suivi des interventions.
- Fonctionnement hors connexion.

### 3.6 PEST AI Intelligence

Responsabilités :
- Orchestration des modèles IA.
- Analyses d'images.
- Diagnostics agricoles.
- Prédictions et détection d'anomalies.
- Recommandations agronomiques.
- Validation humaine.
- Historisation des analyses.
- Gestion des versions des modèles.

Les résultats de l'IA doivent rester distincts des validations réalisées par les agronomes.

### 3.7 PEST AI Cloud & Data Platform

Responsabilités :
- Centralisation des données.
- Nettoyage et validation.
- Enrichissement des données.
- Gestion des métadonnées.
- Préparation des données pour les modèles IA.
- Historisation.
- Gestion de la qualité des données.
- Mise à disposition des données aux modules autorisés.

### 3.8 Fary — Conversational Intelligence

Responsabilités :
- Assistant conversationnel agricole.
- Reconnaissance vocale (ASR).
- Synthèse vocale (TTS).
- Interaction en français, wolof et pulaar selon les capacités validées.
- Conversations contextuelles.
- Accès contrôlé à l'historique agricole.
- Mémoire agricole structurée.
- Interaction avec les fonctionnalités de PEST AI OS.

### 3.9 AgroShield & Field Sensing

Responsabilités :
- Collecte de données de capteurs.
- Intégration des dispositifs terrain.
- Mesures environnementales.
- Données microclimatiques.
- Surveillance des conditions agricoles.
- Transmission et historisation des mesures.

### 3.10 Geospatial & Remote Sensing

Responsabilités :
- Cartographie des parcelles.
- Données satellitaires.
- Télédétection.
- Indices de végétation lorsque les bandes nécessaires sont disponibles.
- Analyse temporelle.
- Images de drones.
- Orthomosaïques.
- Analyses spatiales et zonales.

Les traitements de drones doivent pouvoir être intégrés indépendamment de l'acquisition physique des équipements par PEST AI.

### 3.11 SFA — Agricultural Reliability

Responsabilités :
- Consolidation des données agricoles.
- Indicateurs de fiabilité.
- Historique des performances.
- Traçabilité des pratiques.
- Préparation de rapports pour les partenaires financiers.
- Partage des données autorisées avec consentement du producteur.

Le SFA constitue un indicateur de fiabilité agricole. Il ne représente ni un portefeuille financier ni une décision automatique d'octroi de crédit ou d'assurance.

### 3.12 Finance, Wallet & Billing

Responsabilités :
- Portefeuilles individuels.
- Portefeuilles organisationnels.
- Recharges.
- Crédits promotionnels.
- Consommation des services.
- Réservation et débit des usages.
- Budgets organisationnels.
- Facturation.
- Historique des transactions.

### 3.13 Agricultural Catalog & Suppliers

Responsabilités :
- Catalogue des produits agricoles.
- Fournisseurs.
- Offres commerciales.
- Référencement des intrants.
- Association des produits aux recommandations lorsque pertinent.

### 3.14 Administration & Governance

Responsabilités :
- Administration globale.
- Gestion des paramètres.
- Supervision des organisations.
- Gestion des permissions.
- Journalisation.
- Support utilisateurs.
- Suivi des opérations.

### 3.15 External Integrations & API

Responsabilités :
- APIs partenaires.
- Fournisseurs d'images satellitaires.
- Services météorologiques.
- Services de paiement.
- Banques et assurances.
- Services de stockage.
- Systèmes institutionnels.
- Intégrations futures.

## 4. Architecture en couches

La plateforme est organisée en couches logiques.

### Couche 1 — Interfaces et canaux

- Application mobile Producteur.
- Application mobile Agent terrain.
- Interface Web PEST AI OS.
- Portail de gestion des coopératives.
- Portails partenaires futurs.
- API publiques ou privées selon autorisation.

### Couche 2 — API et sécurité

- Django REST Framework.
- Authentification et autorisation.
- Gestion des permissions.
- Validation des entrées.
- Versionnement des APIs.
- Isolation des organisations.
- Gestion des erreurs.

### Couche 3 — Modules métier

Ensemble des domaines fonctionnels présentés dans la section 3.

Chaque domaine possède des responsabilités explicites et des interfaces d'échange définies.

### Couche 4 — Intelligence et orchestration

- Moteurs IA.
- Traitements asynchrones.
- Orchestration des analyses.
- Workflows métier.
- Système d'événements.
- Gestion des tâches longues.

### Couche 5 — Données et stockage

- Base relationnelle.
- Extension géospatiale.
- Cache.
- Stockage des médias.
- Métadonnées.
- Historique.
- Journalisation.

### Couche 6 — Intégrations externes

- Satellites.
- Drones.
- Météo.
- Paiements.
- Banques.
- Assurances.
- Fournisseurs de services.

### Couche 7 — Infrastructure et exploitation

- Environnements.
- Conteneurisation si nécessaire.
- CI/CD.
- Monitoring.
- Logs techniques.
- Sauvegardes.
- Gestion des secrets.
- Déploiement.

### Couche 8 — Gouvernance et conformité

- Sécurité des données.
- Gestion du consentement.
- Traçabilité.
- Conservation des données.
- Gestion des incidents.
- Contrôle des accès.
- Gouvernance des modèles IA.

## 5. Architecture technique de référence

### Backend

- Python.
- Django.
- Django REST Framework.
- Celery pour les traitements asynchrones.
- Redis comme broker/cache selon les besoins.

### Base de données

- PostgreSQL.
- PostGIS.
- Migrations Django.
- Indexation relationnelle et géospatiale.

### Frontend Web

- React.
- TypeScript.
- Architecture de composants.
- Consommation des APIs REST.

### Mobile

- React Native.
- Expo.
- Architecture offline-first.
- Stockage local adapté aux opérations terrain.
- Synchronisation différée.

### Stockage

- Stockage objet compatible S3.
- Cloudflare R2 ou solution équivalente.
- Métadonnées conservées en base.
- Gestion des accès aux médias.

### Cartographie

- PostGIS.
- MapLibre.
- Services de tuiles cartographiques selon les besoins.
- Formats géospatiaux adaptés.

### Intelligence artificielle

- Services Python.
- Modèles versionnés.
- Pipelines de traitement.
- Services d'inférence.
- Stockage des résultats.
- Suivi des performances.

Les technologies pourront évoluer sans modifier les responsabilités métier des modules.

## 6. Architecture des données

Les données doivent être structurées autour de référentiels canoniques.

Les principaux référentiels sont :

- Identités et organisations.
- Producteurs et équipes.
- Parcelles et géométries.
- Cultures et cycles.
- Missions et observations.
- Diagnostics et recommandations.
- Produits et fournisseurs.
- Transactions et usages.
- Conversations et mémoire agricole.
- Données satellitaires et capteurs.
- Notifications et événements.
- Fichiers et médias.
- Audit et synchronisation.

Les relations détaillées, cardinalités, clés étrangères et contraintes d'intégrité feront l'objet d'un document spécifique : **PEST-AI-OS-Data-Model.md**.

Les diagrammes ERD seront produits à partir de ce référentiel consolidé.

## 7. Architecture multi-organisation

La plateforme doit permettre à plusieurs organisations de fonctionner dans un même environnement.

Exemples :
- Une coopérative gère ses producteurs.
- Une ONG suit plusieurs coopératives.
- Un agent travaille pour plusieurs structures selon les autorisations.
- Un agronome intervient sur plusieurs programmes.
- Un producteur peut être rattaché à plusieurs organisations.

Les données sensibles doivent être protégées par des contrôles d'accès côté serveur.

Le modèle d'isolation sera défini explicitement : rattachement organisationnel, propriété des ressources, périmètre d'accès et règles de partage.

## 8. Architecture offline-first

Le fonctionnement hors connexion est essentiel pour les opérations terrain.

La plateforme doit prévoir :

- Collecte locale.
- Identifiants uniques des opérations.
- Synchronisation différée.
- Détection des doublons.
- Gestion des conflits.
- Suivi des statuts de synchronisation.
- Protection contre les pertes de données.
- Reprise après interruption réseau.

La synchronisation doit être conçue comme un mécanisme transversal, et non comme une fonctionnalité isolée d'un seul module.

## 9. Architecture de sécurité

Les principes de sécurité comprennent :

- Authentification sécurisée.
- Autorisation côté backend.
- Permissions par rôle et organisation.
- Isolation des données.
- Validation des entrées.
- Protection des APIs.
- Gestion sécurisée des fichiers.
- Journalisation des opérations sensibles.
- Chiffrement des communications.
- Sauvegardes et stratégie de restauration.
- Gestion des secrets et variables d'environnement.

Les informations agricoles partagées avec des partenaires financiers doivent respecter les autorisations et consentements applicables.

## 10. Architecture évolutive

L'architecture doit permettre d'ajouter progressivement :

- Nouveaux modèles IA.
- Nouveaux modules agronomiques.
- Nouvelles langues.
- Nouveaux fournisseurs satellitaires.
- Nouveaux capteurs.
- Nouveaux services financiers.
- Nouveaux partenaires.
- Nouveaux pays.
- Nouveaux types d'organisations.

Les modules ne doivent pas dépendre directement des implémentations internes des autres modules lorsqu'une interface métier peut être utilisée.

Le passage à des microservices pourra être envisagé ultérieurement si des contraintes de charge, d'autonomie de déploiement ou de scalabilité le justifient.

## 11. Gouvernance et documentation

Les documents de référence sont :

1. Technical-Architecture-Specification.md
2. PEST-AI-OS-Global-Architecture.md
3. PEST-AI-OS-Implementation-Roadmap.md
4. PEST-AI-OS-Data-Model.md
5. Architecture-Consistency-Audit.md

Toute modification majeure doit être documentée et validée.

Les décisions structurantes doivent être conservées dans un journal de décisions architecturales.

## 12. Objectif final

PEST AI OS doit devenir une infrastructure agricole intégrée capable de relier :

**Parcelle → Données → Intelligence → Décisions → Traçabilité → Fiabilité → Services agricoles et financiers.**

L'architecture globale doit être définie dès le départ, tandis que son implémentation sera progressive, testable et pilotée par des résultats fonctionnels.
