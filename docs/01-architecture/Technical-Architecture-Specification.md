# PEST AI OS — Spécifications de l'architecture technique

## Informations générales du document

| Champ | Valeur |
|---|---|
| Identifiant du document | PESTAI-TAS-001 |
| Projet | PEST AI OS |
| Titre du document | Spécifications de l'architecture technique |
| Version | 1.0 |
| Statut | Brouillon — En cours de validation |
| Responsable du document | Équipe technique PEST AI |
| Dernière mise à jour | Novembre 2026 |
| Langue | Français (explications) / Anglais (termes techniques et code) |

---

## Objectif du document

Ce document définit l'architecture fonctionnelle et technique de PEST AI OS.

Il constitue la référence technique officielle pour la conception, le développement, le déploiement, la maintenance et l'évolution de la plateforme PEST AI.

Tous les contributeurs techniques doivent s'appuyer sur ce document pour prendre des décisions architecturales et développer de nouvelles fonctionnalités.

## Périmètre du document

Ce document couvre les domaines suivants :

- Architecture globale de la plateforme.
- Architecture fonctionnelle et gestion des rôles utilisateurs.
- Architecture des applications.
- Architecture du Backend et des API.
- Architecture de la base de données.
- Gestion des données agricoles et géospatiales.
- Intégration de l'intelligence artificielle.
- Sécurité et gestion des accès.
- Architecture de l'application mobile.
- Infrastructure, DevOps et déploiement.
- Documentation technique et guides destinés aux développeurs.

Le document distingue deux niveaux de périmètre :

- **Périmètre MVP :** fonctionnalités indispensables à la première version opérationnelle de la plateforme.
- **Évolutions futures :** fonctionnalités prévues pour les versions ultérieures.

## Gestion et mise à jour du document

Ce document doit évoluer en même temps que la plateforme.

Toute modification architecturale importante doit être documentée, examinée et validée avant sa mise en œuvre.

Le dépôt GitHub de PEST AI constitue la source officielle de référence pour cette documentation.

# 1. Introduction et vision de la plateforme

## 1.1 Présentation générale du projet

PEST AI OS est une plateforme d'intelligence agricole conçue pour collecter, organiser, analyser et exploiter les données agricoles afin d'améliorer la gestion et le suivi des activités agricoles.

La plateforme vise à transformer chaque parcelle agricole en une unité numérique identifiable, géolocalisée, traçable et exploitable pour la prise de décision.

Elle combine plusieurs catégories de données :

- Données relatives aux producteurs et aux exploitations agricoles.
- Données géographiques et délimitations des parcelles.
- Données agronomiques et observations de terrain.
- Données relatives aux cultures et aux cycles agricoles.
- Données météorologiques et environnementales.
- Images satellitaires et données de télédétection.
- Résultats issus des modèles d'intelligence artificielle.

Ces données sont centralisées et exploitées afin de produire des informations utiles aux producteurs, aux agents de terrain, aux coopératives, aux agronomes, aux ONG et aux partenaires institutionnels.

PEST AI OS ne doit pas être considéré comme une simple application de diagnostic des maladies des cultures. Il constitue une infrastructure numérique destinée à structurer et valoriser l'information agricole.

## 1.2 Vision du projet

La vision de PEST AI est de construire une infrastructure d'intelligence agricole adaptée aux réalités de l'Afrique de l'Ouest, reposant sur les données locales, les connaissances agronomiques, les technologies géospatiales et l'intelligence artificielle.

À terme, la plateforme doit permettre de disposer d'une représentation numérique fiable des exploitations agricoles, de suivre leur évolution et de faciliter l'accès à des services agricoles, techniques, financiers et assurantiels.

## 1.3 Objectifs techniques

L'architecture technique de PEST AI OS doit permettre de :

1. Centraliser les données agricoles provenant de plusieurs sources.
2. Identifier et géolocaliser chaque parcelle grâce au système AgroID.
3. Gérer plusieurs organisations au sein d'une même plateforme, avec des accès contrôlés.
4. Suivre les producteurs, les agents, les campagnes et les cycles agricoles.
5. Organiser les missions et les observations de terrain.
6. Intégrer des services d'intelligence artificielle pour l'analyse des données agricoles.
7. Exploiter les données géospatiales et satellitaires.
8. Faciliter la collaboration entre coopératives, ONG, agronomes et partenaires.
9. Assurer la traçabilité des opérations et des modifications de données.
10. Permettre l'évolution progressive de la plateforme sans devoir reconstruire son architecture.

## 1.4 Principes directeurs de conception

L'architecture de PEST AI OS reposera sur les principes suivants :

**Modularité :** chaque grand domaine fonctionnel doit être organisé en modules indépendants sur le plan logique.

**Sécurité dès la conception :** les mécanismes de sécurité, de confidentialité et de contrôle des accès doivent être intégrés dès le départ.

**Architecture multi-organisations :** plusieurs organisations doivent pouvoir utiliser la même plateforme tout en conservant l'isolation de leurs données.

**Traçabilité :** les opérations importantes et les modifications de données doivent pouvoir être retracées.

**Interopérabilité :** la plateforme doit pouvoir communiquer avec des services externes au moyen d'API documentées.

**Évolutivité :** l'architecture doit permettre l'ajout de nouvelles fonctionnalités et de nouveaux services.

**Fiabilité :** les données doivent être protégées contre les pertes, les doublons et les incohérences, notamment lors des synchronisations mobiles.

**Documentation continue :** chaque évolution technique importante doit être accompagnée d'une documentation à jour.

## 1.5 Périmètre fonctionnel général

La plateforme est destinée à plusieurs catégories d'utilisateurs :

- Administrateurs centraux de PEST AI.
- Administrateurs et responsables des coopératives.
- Agents de terrain.
- Producteurs agricoles.
- Agronomes.
- Responsables et agents de programmes d'ONG.
- Partenaires autorisés.

Chaque catégorie dispose d'un espace de travail et de permissions adaptés à ses responsabilités.

## 1.6 Périmètre de la première version (MVP)

La première version opérationnelle de PEST AI OS doit prioritairement couvrir :

- La gestion des utilisateurs et des organisations.
- La gestion des rôles et des permissions.
- La gestion des coopératives et des ONG.
- La gestion des programmes agricoles.
- La gestion des producteurs et des agents.
- La création et la gestion des parcelles AgroID.
- L'enregistrement des contours géographiques des parcelles.
- La gestion des campagnes et des cycles agricoles.
- La planification et le suivi des opérations de terrain.
- La collecte des observations et des photographies.
- L'intégration progressive du diagnostic par intelligence artificielle sur les cultures et problèmes effectivement pris en charge.
- La validation agronomique des résultats de diagnostic.
- L'application mobile commune aux agents et aux producteurs.
- Le fonctionnement hors ligne et la synchronisation des données.
- Les tableaux de bord et les rapports essentiels.

Les fonctionnalités avancées de financement agricole, d'assurance, d'IoT et d'analyse satellitaire approfondie pourront être développées progressivement selon les priorités et les capacités du projet.

# 2. Objectifs et exigences architecturales

## 2.1 Objectifs architecturaux

L'architecture de PEST AI OS doit répondre aux objectifs suivants :

**A. Centralisation des données**

Disposer d'une plateforme centralisée permettant de collecter, organiser et exploiter les données agricoles provenant de différentes organisations et sources.

**B. Gestion multi-organisations**

Permettre à plusieurs coopératives, ONG, programmes et partenaires d'utiliser la même plateforme, avec une séparation stricte des données et des permissions.

**C. Gestion des utilisateurs et des responsabilités**

Mettre en place un système de gestion des utilisateurs, des rôles, des responsabilités et des autorisations adapté à chaque organisation.

**D. Intelligence agricole**

Permettre l'intégration progressive de modèles d'intelligence artificielle, de données géospatiales, d'images satellitaires et de données environnementales.

**E. Mobilité et collecte de terrain**

Fournir une application mobile permettant aux agents et aux producteurs de consulter et d'enregistrer des informations agricoles, y compris lorsque la connexion Internet est indisponible.

**F. Traçabilité des données**

Conserver l'historique des opérations importantes, des modifications de données et des validations agronomiques.

**G. Évolutivité**

Permettre l'ajout de nouveaux modules, services et intégrations sans remettre en cause l'ensemble de la plateforme.

## 2.2 Exigences de sécurité

La sécurité doit être intégrée à toutes les couches de la plateforme.

Les exigences minimales sont les suivantes :

- Authentification sécurisée des utilisateurs.
- Gestion centralisée des rôles et des permissions.
- Isolation des données entre les organisations.
- Contrôle des accès aux programmes et aux parcelles.
- Protection des communications entre les applications et le Backend.
- Protection des fichiers et des médias stockés.
- Journalisation des opérations sensibles.
- Gestion sécurisée des sessions et des jetons d'accès.
- Protection des données personnelles.
- Sauvegarde régulière des données critiques.

Aucun utilisateur ne doit pouvoir accéder à des données pour lesquelles il ne possède pas les autorisations nécessaires.

## 2.3 Exigences de performance

La plateforme doit offrir une expérience fluide, y compris lorsque les utilisateurs travaillent avec un volume important de parcelles, de producteurs et d'observations.

L'architecture devra notamment prévoir :

- La pagination des listes volumineuses.
- L'optimisation des requêtes vers la base de données.
- L'indexation des données fréquemment recherchées.
- L'optimisation des requêtes géospatiales.
- Le traitement asynchrone des opérations longues.
- La compression et l'optimisation des médias.
- La mise en cache lorsque cela est pertinent.

Les objectifs chiffrés de performance seront définis ultérieurement à partir des volumes réels et des tests de charge.

## 2.4 Disponibilité et résilience

PEST AI OS doit être conçu pour limiter les interruptions de service et prévenir les pertes de données.

Les principes retenus sont :

- Séparer les environnements de développement, de test et de production.
- Prévoir des mécanismes de sauvegarde et de restauration.
- Surveiller la disponibilité des services.
- Enregistrer les erreurs techniques importantes.
- Prévoir des mécanismes de reprise après échec des traitements.
- Éviter qu'une panne d'un service secondaire bloque toute la plateforme.

L'application mobile doit également pouvoir continuer certaines opérations de terrain hors ligne et synchroniser les données lorsque la connexion est rétablie.

## 2.5 Exigences de traçabilité

Les opérations sensibles doivent être traçables.

Le système devra notamment conserver :

- L'identité de l'utilisateur ayant effectué une opération.
- L'organisation concernée.
- La date et l'heure de l'opération.
- La nature de l'action réalisée.
- La référence de l'objet concerné.
- Les informations nécessaires à la compréhension de la modification.

Les données agricoles doivent également conserver leur provenance : utilisateur, appareil, source externe, modèle d'intelligence artificielle ou traitement automatisé.

## 2.6 Interopérabilité et intégration

L'architecture doit faciliter la communication avec les services externes.

Les mécanismes d'intégration pourront inclure :

- Des API REST documentées.
- Des services météorologiques.
- Des fournisseurs de données satellitaires.
- Des services de cartographie.
- Des modèles et services d'intelligence artificielle.
- Des systèmes partenaires autorisés.
- Des services financiers et assurantiels dans les versions futures.

Les intégrations devront être organisées de manière à limiter la dépendance de la plateforme envers un fournisseur unique.

## 2.7 Exigences de maintenabilité

Le code source doit être structuré afin de faciliter sa compréhension, son évolution et sa maintenance par plusieurs développeurs.

Les règles suivantes sont retenues :

- Organisation du code par domaines fonctionnels.
- Séparation de la logique métier et des interfaces.
- Réutilisation des composants communs.
- Tests automatisés des fonctionnalités importantes.
- Documentation des API et des modules.
- Gestion des versions du code avec Git.
- Revue des modifications avant leur intégration dans la branche principale.
- Documentation des décisions architecturales importantes.

## 2.8 Exigences de fonctionnement hors ligne

Le fonctionnement hors ligne constitue une exigence importante pour les opérations agricoles sur le terrain.

L'application mobile devra permettre, selon les fonctionnalités autorisées :

- La consultation des données préalablement synchronisées.
- L'enregistrement local des observations.
- La capture de photographies.
- La préparation des visites et missions.
- La conservation temporaire des données en attente de synchronisation.
- La reprise automatique ou manuelle de la synchronisation.
- La détection des conflits de données.

Chaque opération mobile devra disposer d'un identifiant unique afin de limiter les doublons lors des synchronisations répétées.

## 2.9 Évolutivité fonctionnelle et technique

L'architecture devra permettre l'intégration progressive de nouvelles capacités, notamment :

- Analyse avancée des images satellitaires.
- Intelligence géospatiale.
- Capteurs et dispositifs connectés.
- Services de recommandations agronomiques.
- Analyse des performances agricoles.
- Score de fiabilité agricole (SFA).
- Services d'accès au financement et à l'assurance.
- Interfaces d'intégration destinées aux partenaires.

Ces évolutions ne sont pas toutes incluses dans le MVP. Leur intégration devra respecter les principes architecturaux définis dans ce document.


# 3. Architecture fonctionnelle globale

## 3.1 Présentation

L'architecture fonctionnelle de PEST AI OS définit les principaux domaines métier de la plateforme, leurs responsabilités et leurs interactions.

La plateforme est organisée autour de modules fonctionnels complémentaires qui partagent un socle commun de données, de sécurité et de gestion des accès.

Cette organisation doit permettre de développer, maintenir et faire évoluer chaque domaine sans créer de dépendances inutiles entre les modules.

## 3.2 Modules fonctionnels principaux

### 3.2.1 Gestion des organisations

Ce module permet de gérer les différentes structures utilisant PEST AI OS.

Il couvre notamment :

- La création et la gestion des coopératives.
- La gestion des ONG et des organisations partenaires.
- La gestion des informations administratives.
- La gestion des statuts des organisations.
- La gestion des relations entre les organisations.
- La configuration des espaces de travail.

### 3.2.2 Gestion des utilisateurs et des accès

Ce module centralise les identités des utilisateurs et leurs autorisations.

Il couvre :

- La création et la gestion des comptes.
- Les profils utilisateurs.
- Les rôles et permissions.
- Les appartenances à plusieurs organisations.
- Les responsabilités opérationnelles.
- Les accès temporaires ou limités à certains programmes.

Un utilisateur peut appartenir à plusieurs organisations avec des rôles différents.

### 3.2.3 Gestion des producteurs et des agents

Ce module permet de gérer les acteurs agricoles et opérationnels.

Il couvre :

- Les profils des producteurs.
- Les profils des agents de terrain.
- Les informations de contact.
- Les rattachements organisationnels.
- Les affectations géographiques et opérationnelles.
- L'historique des interventions.

### 3.2.4 Gestion des parcelles AgroID

AgroID constitue le système d'identification numérique des parcelles agricoles.

Chaque parcelle doit disposer d'un identifiant unique permettant de retrouver et de suivre ses informations dans le temps.

Le module couvre :

- La création des parcelles.
- L'attribution des identifiants AgroID.
- La géolocalisation.
- L'enregistrement des contours géographiques.
- La gestion des producteurs associés.
- L'historique des modifications géographiques.
- Le suivi de l'exploitation agricole.

### 3.2.5 Gestion des campagnes et des cycles agricoles

Ce module organise les activités agricoles dans le temps.

Il distingue :

- Les saisons agricoles.
- Les campagnes agricoles.
- Les cycles de culture associés aux parcelles.
- Les étapes de développement des cultures.
- Les opérations agricoles planifiées et réalisées.

Une campagne peut concerner plusieurs producteurs et plusieurs parcelles. Chaque parcelle peut disposer de son propre cycle agricole.

### 3.2.6 Gestion des opérations de terrain

Ce module organise les activités réalisées par les agents et les autres intervenants autorisés.

Il couvre :

- La planification des missions.
- L'affectation des agents.
- Les visites de parcelles.
- La collecte des observations.
- La prise de photographies.
- Le suivi des interventions.
- L'historique des opérations.

### 3.2.7 Intelligence agricole et services IA

Ce domaine regroupe les capacités d'analyse et de traitement intelligent des données agricoles.

Il couvre progressivement :

- L'analyse des images agricoles.
- L'identification des problèmes pris en charge par les modèles.
- La production de résultats de diagnostic assistés par IA.
- La validation par les agronomes.
- Les recommandations agronomiques.
- L'analyse des risques agricoles.
- L'exploitation des données historiques.

Les résultats produits par l'intelligence artificielle ne remplacent pas automatiquement la validation agronomique.

### 3.2.8 Calendrier agricole intelligent

Ce module permet de planifier et de suivre les activités agricoles en tenant compte des zones agroécologiques et des cultures.

Il couvre :

- Les saisons agricoles par zone.
- Les modèles de calendrier par culture.
- Les étapes théoriques des cycles.
- Les dates prévisionnelles.
- Les étapes réellement observées.
- Les opérations agricoles associées.

Les dates prévisionnelles doivent être distinguées des événements réellement observés sur le terrain.

### 3.2.9 Intelligence géospatiale et environnementale

Ce module organise les données géographiques et environnementales.

Il couvre progressivement :

- La cartographie des parcelles.
- Les zones agroécologiques.
- Les données satellitaires.
- Les indicateurs de végétation.
- Les données météorologiques.
- Les données environnementales.
- Les couches géographiques thématiques.

### 3.2.10 Reporting et analyse des données

Ce module permet de transformer les données opérationnelles en indicateurs utiles à la prise de décision.

Il couvre :

- Les tableaux de bord des coopératives.
- Les rapports des programmes ONG.
- Les indicateurs agricoles.
- Le suivi des activités des agents.
- Les statistiques des parcelles et des producteurs.
- Les rapports destinés aux partenaires autorisés.

## 3.3 Services transversaux

Certains services sont communs à plusieurs modules :

- Authentification et autorisation.
- Notifications.
- Journalisation et audit.
- Gestion des fichiers et des médias.
- Synchronisation mobile.
- Gestion des tâches en arrière-plan.
- Documentation et intégration des API.

Ces services constituent le socle technique partagé de la plateforme.

## 3.4 PEST AI Cloud

PEST AI Cloud constitue la couche de traitement et d'intelligence de la plateforme.

Elle organise les traitements de données, les services d'intelligence artificielle et les interactions avec les sources de données externes.

Elle doit permettre de faire évoluer progressivement les capacités analytiques de PEST AI sans rendre les modules métier dépendants d'un modèle ou d'un fournisseur spécifique.

## 3.5 Organisation du périmètre fonctionnel

Les modules fonctionnels ne seront pas tous développés simultanément.

Le MVP donnera la priorité à la gestion des organisations, des utilisateurs, des producteurs, des agents, des parcelles AgroID, des campagnes, des cycles agricoles, des opérations terrain et des premières capacités d'intelligence artificielle validées par les agronomes.

Les fonctionnalités avancées seront intégrées progressivement selon les priorités du projet.

# 4. Acteurs, rôles et espaces de travail

## 4.1 Principes généraux

PEST AI OS est conçu pour être utilisé par plusieurs catégories d'acteurs intervenant dans l'écosystème agricole.

Chaque acteur dispose de responsabilités, de permissions et d'un espace de travail adaptés à son rôle.

La plateforme doit permettre à un même utilisateur d'intervenir dans plusieurs organisations, sans multiplier inutilement ses comptes.

Les autorisations sont définies en fonction de son identité, de son rôle, de son organisation de rattachement et, lorsque nécessaire, de son périmètre d'intervention.

## 4.2 Administrateur central PEST AI

L'administrateur central dispose des responsabilités nécessaires à la gestion globale de la plateforme.

Ses principales responsabilités sont :

- Gérer les organisations enregistrées.
- Administrer les comptes et les accès.
- Configurer les paramètres globaux.
- Superviser les activités de la plateforme.
- Gérer les services et modules communs.
- Consulter les journaux d'audit autorisés.
- Assurer le suivi technique et opérationnel global.

Son espace de travail est l'administration centrale PEST AI.

## 4.3 Administrateur d'organisation

Chaque organisation dispose d'un ou plusieurs administrateurs responsables de son espace.

Ses responsabilités sont :

- Gérer les informations de son organisation.
- Inviter et gérer ses membres.
- Attribuer les rôles autorisés.
- Organiser les équipes.
- Gérer les accès aux données de l'organisation.
- Superviser les activités de sa structure.

Un administrateur d'organisation ne doit pas pouvoir administrer les données internes d'une autre organisation sans autorisation explicite.

## 4.4 Responsable opérationnel

Le responsable opérationnel supervise les activités agricoles et les équipes de son organisation.

Ses responsabilités peuvent inclure :

- Superviser les agents de terrain.
- Organiser les missions.
- Suivre les campagnes agricoles.
- Superviser les producteurs et les parcelles.
- Consulter les observations.
- Suivre les indicateurs opérationnels.
- Produire des rapports d'activité.

Ses permissions sont définies par l'administrateur de son organisation, dans les limites de ses propres autorisations.

## 4.5 Agent de terrain

L'agent de terrain intervient directement auprès des producteurs et sur les parcelles agricoles.

Ses principales responsabilités sont :

- Consulter les missions qui lui sont affectées.
- Identifier les producteurs.
- Consulter les parcelles AgroID autorisées.
- Enregistrer les visites de terrain.
- Collecter les observations agricoles.
- Prendre et joindre des photographies.
- Enregistrer les informations relatives aux cultures.
- Synchroniser les données collectées.

L'agent utilise l'application mobile PEST AI dans un espace adapté à ses missions.

## 4.6 Producteur agricole

Le producteur utilise l'application mobile PEST AI pour accéder aux informations relatives à son exploitation.

Ses fonctionnalités peuvent inclure :

- Consulter ses parcelles AgroID.
- Consulter les informations relatives à ses cultures.
- Suivre les étapes de ses cycles agricoles.
- Consulter les recommandations validées qui lui sont destinées.
- Consulter les observations et interventions autorisées.
- Recevoir des notifications.
- Transmettre des informations relatives à son exploitation.

Le producteur ne peut accéder qu'aux données auxquelles il est autorisé.

## 4.7 Agronome

L'agronome dispose d'un espace de travail professionnel lui permettant d'intervenir sur les données agricoles et les diagnostics.

Ses responsabilités peuvent inclure :

- Examiner les observations de terrain.
- Analyser les résultats produits par l'intelligence artificielle.
- Valider ou rejeter les diagnostics proposés.
- Ajouter des commentaires techniques.
- Produire ou valider des recommandations agronomiques.
- Suivre les cas nécessitant une expertise.
- Intervenir dans plusieurs organisations ou programmes lorsqu'il dispose des autorisations nécessaires.

Les interventions d'un agronome doivent être tracées et associées à son identité.

## 4.8 Responsable ONG et gestionnaire de programme

Les ONG peuvent utiliser PEST AI OS pour gérer leurs programmes agricoles et suivre les activités réalisées avec plusieurs coopératives.

Leurs responsabilités peuvent inclure :

- Créer et administrer des programmes autorisés.
- Associer plusieurs coopératives à un même programme.
- Définir les zones d'intervention.
- Suivre les producteurs et les parcelles concernés.
- Consulter les indicateurs du programme.
- Suivre les activités des équipes.
- Produire des rapports destinés aux partenaires et aux bailleurs.

L'accès aux données des coopératives participantes doit être limité au périmètre autorisé par le programme et les accords applicables.

## 4.9 Partenaire externe

Un partenaire externe peut être une institution, une entreprise agricole, un fournisseur de services ou un organisme disposant d'un accès spécifique.

Ses permissions dépendent de la nature de son partenariat et des données auxquelles il est autorisé à accéder.

Les accès partenaires peuvent notamment concerner :

- La consultation de rapports.
- L'accès à certains indicateurs.
- La consultation de données agricoles autorisées.
- L'utilisation d'API spécifiques.
- Le suivi de projets ou de programmes.

## 4.10 Espaces de travail de la plateforme

PEST AI OS sera organisé autour des espaces suivants :

**Administration centrale :** gestion globale de la plateforme.

**Espace Coopérative :** gestion des producteurs, agents, parcelles, campagnes, opérations et rapports.

**Espace ONG :** gestion des programmes, des coopératives participantes et des indicateurs.

**Espace Agronome :** expertise, validation des diagnostics et recommandations.

**Espace Partenaire :** accès limité aux informations et services autorisés.

**Application mobile Agent :** missions, visites, collecte et synchronisation des données de terrain.

**Application mobile Producteur :** consultation et suivi de son exploitation agricole.

Les espaces Agent et Producteur seront intégrés dans une application mobile commune. L'interface et les fonctionnalités disponibles dépendront du rôle et des permissions de l'utilisateur.

## 4.11 Gestion des programmes multi-organisations

Un programme agricole peut impliquer plusieurs organisations.

Par exemple, une ONG peut créer un programme et y associer plusieurs coopératives intervenant dans différentes zones géographiques.

La relation entre un programme et une organisation participante doit permettre de définir :

- L'organisation participante.
- Son rôle dans le programme.
- Son périmètre d'intervention.
- Ses dates de participation.
- Son statut.
- Les permissions accordées.

Une organisation peut également participer à plusieurs programmes.

Cette relation doit être gérée explicitement afin de contrôler les accès et de garantir la traçabilité des interventions.

## 4.12 Règles générales de gestion des accès

Les règles suivantes doivent être respectées :

- **ACC-001 :** chaque organisation dispose d'un périmètre de données isolé.
- **ACC-002 :** les administrateurs d'organisation gèrent uniquement les membres et les données relevant de leurs autorisations.
- **ACC-003 :** les agronomes peuvent intervenir dans plusieurs organisations uniquement sur la base d'affectations et d'autorisations explicites.
- **ACC-004 :** les ONG accèdent uniquement aux données nécessaires à leurs programmes autorisés.
- **ACC-005 :** un utilisateur peut appartenir à plusieurs organisations avec des rôles différents.
- **ACC-006 :** les opérations sensibles doivent être enregistrées dans les journaux d'audit.
- **ACC-007 :** les synchronisations mobiles ne doivent provoquer ni perte silencieuse ni duplication des données.
- **ACC-008 :** un résultat produit par l'intelligence artificielle ne constitue pas automatiquement un diagnostic agronomique validé.


## 5. Architecture technique et choix des technologies

### 5.1. Principes techniques

L'architecture technique de PEST AI OS repose sur les principes suivants :

- **Modularité :** organiser le système en modules fonctionnels indépendants.
- **Évolutivité :** permettre l'ajout progressif de nouvelles fonctionnalités.
- **API-first :** centraliser les échanges entre les applications et le backend à travers des API.
- **Sécurité :** protéger les données et contrôler les accès selon les organisations et les rôles.
- **Géospatial :** intégrer nativement la gestion des parcelles, des coordonnées et des données géographiques.
- **Offline-first :** permettre aux agents de terrain de collecter des données même sans connexion Internet.

### 5.2. Stack technologique retenu

Les technologies de référence pour le développement de PEST AI OS sont les suivantes :

| Composant | Technologie | Responsabilité |
|---|---|---|
| Application web | React + TypeScript | Interface de gestion et d'administration |
| Application mobile | React Native + Expo | Application mobile des agents et producteurs |
| Backend | Django + Django REST Framework | Logique métier et API |
| Base de données | PostgreSQL + PostGIS | Données métier et données géographiques |
| Cartographie | MapLibre | Affichage et exploration des parcelles |
| Tâches asynchrones | Celery + Redis | Traitements en arrière-plan |
| Stockage de fichiers | Cloudflare R2 ou stockage compatible S3 | Images, documents et fichiers |
| Documentation technique | MkDocs | Portail documentaire des développeurs |

### 5.3. Architecture du backend

Le backend sera développé avec Django et Django REST Framework.

Il constituera le cœur métier de PEST AI OS et sera responsable notamment de :

- La gestion des utilisateurs et des authentifications.
- La gestion des organisations et des permissions.
- La gestion des parcelles AgroID.
- La gestion des producteurs, agents et agronomes.
- La gestion des programmes et campagnes agricoles.
- La collecte et la validation des observations agricoles.
- La gestion des cycles et calendriers agricoles.
- L'orchestration des traitements d'intelligence artificielle.
- La communication avec les services externes.

Le backend adoptera une architecture de type **modular monolith** pour la première version. Les modules seront organisés de manière cohérente au sein d'une application backend unique.

Une évolution vers des microservices pourra être envisagée ultérieurement si les besoins techniques et opérationnels le justifient.

### 5.4. Architecture de la base de données

PostgreSQL sera utilisé comme système principal de gestion des données.

L'extension PostGIS permettra de gérer les informations géographiques, notamment :

- Les coordonnées GPS.
- Les polygones et contours des parcelles.
- Les surfaces agricoles.
- Les zones agroécologiques.
- Les données géographiques associées aux programmes.
- Les analyses spatiales et satellitaires.

La base de données devra prendre en charge les relations entre les organisations, les utilisateurs, les producteurs, les parcelles et les activités agricoles.

### 5.5. Applications clientes

**Application web**

Développée avec React et TypeScript, elle permettra aux organisations d'accéder à leurs espaces de travail respectifs.

Elle prendra notamment en charge les espaces d'administration, de gestion des coopératives, des programmes et des opérations agricoles.

**Application mobile**

Développée avec React Native et Expo, elle reposera sur une application commune pour les agents de terrain et les producteurs.

Les fonctionnalités accessibles dépendront du rôle et des autorisations de chaque utilisateur.

L'application devra notamment prendre en charge la collecte de données hors connexion et leur synchronisation lorsque le réseau sera disponible.

### 5.6. Traitements asynchrones et stockage

Celery et Redis seront utilisés pour exécuter les traitements qui ne doivent pas bloquer les applications clientes.

Les cas d'utilisation pourront inclure :

- Les traitements d'images agricoles.
- Les analyses d'intelligence artificielle.
- Les traitements de données satellitaires.
- La génération de rapports.
- Les notifications et tâches planifiées.

Les images, documents et autres fichiers volumineux seront conservés dans un stockage objet compatible avec le protocole S3.

### 5.7. Organisation des environnements

Le développement de PEST AI OS reposera progressivement sur trois environnements distincts :

- **Development :** environnement de développement et de tests techniques.
- **Staging :** environnement de préproduction destiné à valider les nouvelles fonctionnalités.
- **Production :** environnement utilisé par les organisations et les utilisateurs finaux.

Les déploiements devront être contrôlés afin de limiter les risques de régression et de perte de données.

### 5.8. Documentation et maintenance technique

La documentation technique sera centralisée dans le dépôt GitHub du projet.

MkDocs sera utilisé pour construire progressivement un portail documentaire destiné aux développeurs.

La documentation devra couvrir notamment :

- L'architecture générale.
- Les modules backend et frontend.
- Le modèle de données.
- Les API.
- Les règles de sécurité.
- Les procédures de déploiement.
- Les procédures de maintenance.

Les décisions techniques importantes devront être documentées et mises à jour au fur et à mesure de l'évolution de la plateforme.

### 5.9. Statut des décisions techniques

Les technologies présentées dans cette section constituent le stack technique de référence validé pour la conception de PEST AI OS.

Les versions précises des technologies, les fournisseurs d'hébergement et les configurations de production seront définis au cours des étapes d'implémentation.


## 6. Architecture de la base de données

### 6.1. Objectifs

La base de données de PEST AI OS doit permettre de centraliser, organiser, sécuriser et exploiter l'ensemble des données agricoles, géographiques, opérationnelles et institutionnelles de la plateforme.

Elle doit notamment permettre :

- La gestion de plusieurs organisations et de leurs utilisateurs.
- L'identification numérique unique des parcelles à travers AgroID.
- Le suivi des producteurs, des unités de culture et des cycles agricoles.
- La gestion des programmes, campagnes et activités agricoles.
- La collecte et l'historisation des observations terrain.
- La gestion des diagnostics, recommandations et analyses d'intelligence artificielle.
- L'intégration des données satellitaires, météorologiques et IoT.
- Le calcul et l'historisation du score SFA.
- La gestion des fournisseurs, des produits agricoles et des commandes.
- La gestion des autorisations, de la traçabilité et de la synchronisation hors connexion.

L'architecture doit être évolutive afin de supporter les fonctionnalités du MVP et les futures extensions de PEST AI OS.

### 6.2. Principes de conception

La conception de la base de données reposera sur les principes suivants :

**1. Architecture relationnelle**

PostgreSQL sera utilisé comme système principal de gestion de base de données. Les informations seront organisées en entités reliées entre elles par des clés primaires et étrangères.

**2. Gestion géospatiale**

PostGIS permettra de stocker et d'exploiter les données géographiques, notamment les coordonnées, les contours des parcelles, les unités de culture et les zones agricoles.

**3. Identité unique des parcelles**

Chaque parcelle disposera d'un identifiant AgroID unique dans l'ensemble de PEST AI OS. Cet identifiant sera conservé même en cas de changement de producteur, d'exploitant ou d'organisation.

**4. Architecture multi-organisations**

Une même plateforme pourra accueillir plusieurs coopératives, ONG, institutions, programmes et partenaires. Les données seront cloisonnées selon les organisations et les autorisations accordées.

**5. Historisation**

Les données importantes devront conserver leur historique : changements d'affectation, cycles agricoles, diagnostics, recommandations, scores SFA, opérations et modifications.

**6. Traçabilité**

Les actions importantes devront être associées à leur auteur, leur date, leur organisation de rattachement et leur contexte.

**7. Évolutivité**

La structure devra permettre l'ajout de nouvelles cultures, de nouveaux modèles IA, de nouveaux capteurs, de nouveaux partenaires et de nouveaux services sans remettre en cause l'ensemble de l'architecture.

### 6.3. Organisation des domaines de données

La base de données sera organisée autour des domaines fonctionnels suivants.

#### 6.3.1. Organisations et gestion des accès

Ce domaine gère les organisations présentes dans PEST AI OS et les accès de leurs membres.

Entités principales :

- `Organization` : coopérative, ONG, institution, entreprise ou partenaire.
- `OrganizationType` : catégorie d'organisation.
- `User` : compte utilisateur de la plateforme.
- `OrganizationMembership` : relation entre un utilisateur et une organisation.
- `Role` : rôle attribué à un utilisateur.
- `Permission` : autorisation associée à une fonctionnalité.
- `ProgramMembership` : participation d'un utilisateur à un programme, lorsque nécessaire.

Un utilisateur peut appartenir à plusieurs organisations et disposer de rôles différents selon chacune d'elles.

Le statut d'une adhésion est indépendant du compte utilisateur : une adhésion peut être en attente, active, suspendue ou révoquée sans désactiver automatiquement le compte dans les autres organisations.

PEST AI conserve un rôle de superadministration sur la plateforme.

#### 6.3.2. Producteurs et agents

Ce domaine représente les personnes intervenant dans les activités agricoles.

Entités principales :

- `Producer` : profil central du producteur.
- `ProducerOrganizationAssignment` : rattachement d'un producteur à une organisation.
- `FieldAgent` : profil opérationnel d'un agent terrain.
- `AgronomistProfile` : profil professionnel d'un agronome.
- `ProducerContact` : informations de contact et moyens de communication.

Un producteur peut être affilié à plusieurs organisations ou programmes tout en conservant un profil central.

L'affiliation agricole d'un producteur est distincte de l'accès à un compte utilisateur. Un producteur peut donc être enregistré dans PEST AI OS sans posséder de compte de connexion.

#### 6.3.3. Parcelles agricoles et AgroID

Ce domaine constitue l'un des éléments centraux de PEST AI OS.

Entités principales :

- `Parcel` : parcelle agricole identifiée par un AgroID unique.
- `ParcelGeometry` : géométrie géographique de la parcelle.
- `ParcelAssignment` : relation historique entre une parcelle et son exploitant.
- `ParcelOwnership` : informations relatives à la propriété ou aux droits sur la parcelle.
- `CultivationUnit` : unité géographique représentant une partie de la parcelle consacrée à une culture.
- `GeographicZone` : zone géographique ou agricole de référence.

La propriété foncière doit être distinguée de l'exploitation agricole réelle.

Une parcelle peut avoir plusieurs exploitants successifs au cours du temps. Ces changements doivent être historisés.

Une même parcelle peut également contenir plusieurs unités de culture. Chaque unité possède sa propre géométrie et peut accueillir des cultures différentes.

Les unités de culture doivent être géographiquement cohérentes avec les limites de la parcelle principale.

#### 6.3.4. Cycles de culture et campagnes agricoles

Ce domaine permet de suivre les activités agricoles dans le temps.

Entités principales :

- `AgriculturalCampaign` : campagne agricole correspondant à une période opérationnelle.
- `CropCycle` : cycle réel d'une culture sur une parcelle ou une unité de culture.
- `Crop` : type de culture.
- `CropVariety` : variété cultivée.
- `CropStage` : stade de développement.
- `CropCalendar` : calendrier prévisionnel de culture.

Une campagne agricole et un cycle de culture représentent deux notions différentes.

Une campagne peut concerner plusieurs cultures et plusieurs parcelles. Un cycle de culture représente une culture effectivement pratiquée sur une parcelle ou une unité de culture.

Une parcelle peut accueillir plusieurs cycles successifs au cours d'une même année.

Les stades prévisionnels doivent être distingués des stades réellement observés.

#### 6.3.5. Programmes agricoles

Ce domaine permet de gérer les initiatives d'accompagnement portées par des ONG, institutions, entreprises ou partenaires.

Entités principales :

- `Program` : programme agricole.
- `ProgramOrganization` : association entre un programme et les organisations participantes.
- `ProgramBeneficiary` : bénéficiaire d'un programme.
- `ProgramParcel` : parcelle suivie dans le cadre d'un programme.

Un programme peut intégrer plusieurs coopératives et organisations. Une organisation peut participer à plusieurs programmes.

Un programme peut suivre des producteurs et des parcelles sur plusieurs campagnes agricoles.

Un producteur indépendant peut également être bénéficiaire d'un programme sans être affilié à une coopérative participante.

#### 6.3.6. Missions et activités terrain

Ce domaine permet de planifier et de suivre le travail des agents et des agronomes.

Entités principales :

- `FieldMission` : mission terrain.
- `MissionAgent` : agents affectés à une mission.
- `MissionParcel` : parcelles concernées par une mission.
- `FieldVisit` : visite réellement effectuée.
- `FieldVisitReport` : compte rendu de visite.

Une mission peut être affectée à plusieurs agents et concerner plusieurs parcelles.

Une parcelle peut faire l'objet de plusieurs visites au fil du temps.

La planification d'une mission doit être distinguée de la visite réellement effectuée.

#### 6.3.7. Observations, diagnostics et intelligence artificielle

Ce domaine centralise les observations et les analyses produites par les systèmes d'intelligence artificielle et les professionnels agricoles.

Entités principales :

- `Observation` : observation réalisée sur le terrain.
- `ObservationMedia` : photos, vidéos et autres éléments associés.
- `AIAnalysisJob` : traitement ou analyse effectuée par un modèle IA.
- `AIModel` : modèle d'intelligence artificielle.
- `AIModelVersion` : version du modèle utilisée.
- `Diagnostic` : résultat d'un diagnostic.
- `DiagnosticEvidence` : éléments justificatifs du diagnostic.
- `DiagnosticReview` : validation, correction ou rejet par un agronome.

Une observation peut déclencher plusieurs analyses IA.

Chaque analyse doit conserver le modèle et la version utilisés, les résultats, les éléments de preuve et le niveau de confiance lorsque celui-ci est disponible.

Un agronome peut confirmer, corriger ou rejeter un résultat généré par l'IA.

Il peut également créer directement un diagnostic sans utiliser l'intelligence artificielle.

Les diagnostics générés par l'IA et ceux créés directement par un agronome doivent être clairement distingués.

Les résultats initiaux de l'IA et les validations humaines doivent être conservés dans l'historique. Une validation humaine ne doit pas effacer le résultat initial.

#### 6.3.8. Recommandations et produits agricoles

Ce domaine gère les recommandations agronomiques et les produits pouvant être associés à ces recommandations.

Entités principales :

- `Recommendation` : recommandation agricole.
- `RecommendationAction` : action concrète à effectuer.
- `RecommendationFollowup` : suivi de l'application d'une recommandation.
- `AgriculturalProduct` : produit agricole référencé.
- `ProductRecommendation` : association entre une recommandation et un produit pertinent.

Les recommandations peuvent être générées par l'intelligence artificielle ou créées directement par un agronome.

Elles peuvent être liées à un diagnostic, à une observation ou à d'autres données agricoles.

Les produits suggérés peuvent notamment concerner les semences, engrais, produits phytosanitaires et autres intrants agricoles.

Les recommandations agronomiques doivent rester indépendantes des intérêts commerciaux des fournisseurs. La présence d'un produit dans le catalogue ne doit pas influencer le diagnostic.

#### 6.3.9. Données satellitaires et environnementales

Ce domaine permet de centraliser les informations environnementales et géospatiales utiles au suivi agricole.

Entités principales :

- `SatelliteScene` : scène ou image satellitaire.
- `ParcelSatelliteMetric` : indicateur satellitaire associé à une parcelle et à une date.
- `WeatherStation` : station météorologique.
- `WeatherObservation` : observation météorologique.
- `WeatherForecast` : prévision météorologique.
- `EnvironmentalMeasurement` : mesure environnementale.
- `MicroclimateRecord` : donnée relative au microclimat.
- `GeospatialLayer` : couche géographique exploitable.

Les données satellitaires doivent être historisées afin de permettre la comparaison de l'évolution des parcelles au fil des dates et des campagnes.

Les indicateurs pourront notamment inclure le NDVI, le NDWI et d'autres mesures pertinentes pour l'analyse agricole.

Ces données pourront alimenter les modèles IA, les alertes et les outils de suivi des cultures.

#### 6.3.10. IoT et capteurs

Ce domaine permet d'intégrer les dispositifs connectés utilisés pour la collecte de données agricoles et environnementales.

Entités principales :

- `IoTDevice` : dispositif connecté.
- `DeviceType` : type de dispositif.
- `Sensor` : capteur associé à un dispositif.
- `DeviceInstallation` : installation d'un dispositif sur un emplacement.
- `SensorMeasurement` : mesure transmise par un capteur.
- `DeviceAlert` : alerte liée à un dispositif.
- `DeviceMaintenance` : intervention de maintenance.

Un dispositif peut être installé sur une parcelle, une zone agricole, une station météo ou un autre emplacement géographique autorisé.

L'architecture doit permettre l'intégration de différents fabricants et protocoles de communication.

Les mesures doivent conserver leur date, leur origine, leur unité et leur contexte géographique.

#### 6.3.11. Finance, assurance et SFA

Ce domaine permet de préparer les dossiers agricoles et de faciliter les échanges avec les institutions financières et les assureurs.

Entités principales :

- `FinancialInstitution` : banque ou institution financière.
- `InsuranceCompany` : compagnie d'assurance.
- `FinancialProduct` : produit financier.
- `InsuranceProduct` : produit d'assurance.
- `SFAAssessment` : évaluation SFA.
- `SFAScoreHistory` : historique des scores.
- `AgriculturalRiskAssessment` : évaluation du risque agricole.
- `FinancingApplication` : dossier de demande de financement.
- `InsuranceApplication` : dossier de demande d'assurance.
- `FinancialDataConsent` : autorisation de partage des données.
- `FinancialPartnerAccess` : accès accordé à un partenaire.

Le SFA est un indicateur dynamique et historisé de fiabilité agricole.

PEST AI OS fournit les données agricoles, les analyses de risque et les dossiers nécessaires à l'évaluation des producteurs.

Les banques restent responsables de leurs décisions de crédit. Les compagnies d'assurance restent responsables de leurs décisions de couverture et d'indemnisation.

Le partage des informations avec un partenaire financier ou assurantiel doit respecter les autorisations accordées par le producteur.

#### 6.3.12. Fournisseurs, catalogue et commandes

Ce domaine permet de mettre en relation les producteurs, les coopératives et les fournisseurs d'intrants agricoles.

Entités principales :

- `Supplier` : fournisseur partenaire.
- `SupplierMembership` : utilisateurs rattachés à un fournisseur.
- `AgriculturalProduct` : produit référencé dans le catalogue.
- `SupplierProduct` : offre d'un fournisseur pour un produit.
- `ProductOrder` : commande.
- `OrderItem` : ligne de commande.
- `OrderBeneficiary` : bénéficiaire d'une commande groupée.
- `SupplierContact` : demande de contact avec un fournisseur.
- `OrderStatusHistory` : historique des changements de statut.
- `PaymentRecord` : information relative au suivi du paiement.

Les fournisseurs disposent d'un espace professionnel leur permettant de gérer leur catalogue et de suivre les commandes reçues.

Un producteur peut commander pour ses propres besoins. Une coopérative peut également passer une commande groupée pour plusieurs membres.

Une commande groupée doit conserver le détail des quantités demandées par chaque bénéficiaire.

Les utilisateurs peuvent consulter les produits, contacter les fournisseurs ou passer commande depuis la plateforme.

Les commandes doivent conserver leur fournisseur, leurs produits, leurs quantités, leurs statuts et leur historique.

Dans la première version, les paiements pourront être organisés directement entre le client et le fournisseur, en dehors de PEST AI OS. Une intégration ultérieure de moyens de paiement tels que Wave ou Orange Money pourra être envisagée.

#### 6.3.13. Notifications et traçabilité

Ce domaine gère les notifications, les alertes et l'historique des actions réalisées dans la plateforme.

Entités principales :

- `Notification` : notification adressée à un utilisateur.
- `NotificationTemplate` : modèle de notification.
- `NotificationPreference` : préférences de réception.
- `NotificationDelivery` : suivi de livraison d'une notification.
- `Alert` : alerte opérationnelle ou agricole.
- `AuditEvent` : événement de traçabilité.
- `SystemEvent` : événement technique.
- `UserActivity` : activité réalisée par un utilisateur.

Les notifications pourront être envoyées par différents canaux : application, notifications mobiles, SMS et e-mail.

Chaque action importante devra pouvoir être retracée : auteur, date, organisation, action réalisée et donnée concernée.

Les notifications et les informations transmises devront respecter les rôles et autorisations de chaque utilisateur.

#### 6.3.14. Synchronisation hors connexion

Ce domaine prend en charge le fonctionnement Offline-first de l'application mobile.

Entités principales à prévoir :

- `MobileDevice` : appareil utilisé pour accéder à l'application.
- `SyncBatch` : ensemble d'opérations à synchroniser.
- `SyncEvent` : opération de synchronisation.
- `SyncConflict` : conflit détecté pendant la synchronisation.

Les opérations réalisées hors connexion devront être conservées localement avant leur transmission au serveur.

La synchronisation devra gérer :

- Les données en attente de synchronisation.
- Les tentatives de synchronisation.
- Les erreurs et les nouvelles tentatives.
- La détection des doublons.
- Les conflits de modification.
- La confirmation de réception par le serveur.

Aucune modification importante ne devra être écrasée silencieusement.

Les données locales devront également respecter les règles de sécurité et les droits d'accès des utilisateurs.

### 6.4. Relations principales entre les entités

Les relations structurantes de la base de données sont les suivantes :

| Relation | Type de relation | Description |
|---|---|---|
| User ↔ Organization | N:N | Un utilisateur peut appartenir à plusieurs organisations via OrganizationMembership. |
| Producer ↔ Organization | N:N | Un producteur peut être affilié à plusieurs organisations via ProducerOrganizationAssignment. |
| Producer ↔ Parcel | N:N dans le temps | Les affectations successives sont conservées via ParcelAssignment. |
| Parcel ↔ CultivationUnit | 1:N | Une parcelle peut contenir plusieurs unités de culture. |
| Parcel / CultivationUnit ↔ CropCycle | 1:N | Une parcelle ou unité peut accueillir plusieurs cycles de culture successifs. |
| Program ↔ Organization | N:N | Un programme peut être porté ou suivi par plusieurs organisations. |
| Program ↔ Parcel | N:N | Un programme peut suivre plusieurs parcelles et une parcelle peut participer à plusieurs programmes. |
| FieldMission ↔ FieldAgent | N:N | Une mission peut être affectée à plusieurs agents. |
| FieldMission ↔ Parcel | N:N | Une mission peut concerner plusieurs parcelles. |
| Parcel ↔ FieldVisit | 1:N | Une parcelle peut faire l'objet de plusieurs visites. |
| Observation ↔ AIAnalysisJob | 1:N | Une observation peut déclencher plusieurs analyses IA. |
| Diagnostic ↔ DiagnosticReview | 1:N | Un diagnostic peut faire l'objet de plusieurs validations ou corrections. |
| Recommendation ↔ AgriculturalProduct | N:N | Une recommandation peut proposer plusieurs produits pertinents. |
| CropCycle ↔ AgriculturalOperation | 1:N | Un cycle de culture possède un historique d'opérations agricoles. |
| CropCycle ↔ HarvestRecord | 1:N | Un cycle peut comporter plusieurs enregistrements de récolte. |
| Parcel ↔ ParcelSatelliteMetric | 1:N | Une parcelle possède un historique de mesures satellitaires. |
| IoTDevice ↔ DeviceInstallation | 1:N | Un dispositif peut avoir plusieurs installations successives. |
| Sensor ↔ SensorMeasurement | 1:N | Un capteur produit plusieurs mesures. |
| Producer ↔ SFAAssessment | 1:N | Un producteur peut avoir plusieurs évaluations SFA dans le temps. |
| Supplier ↔ SupplierProduct | 1:N | Un fournisseur peut proposer plusieurs produits. |
| ProductOrder ↔ OrderItem | 1:N | Une commande contient une ou plusieurs lignes de produits. |
| ProductOrder ↔ Supplier | N:1 | Une commande est adressée à un fournisseur donné. |
| User ↔ Notification | 1:N | Un utilisateur peut recevoir plusieurs notifications. |

Les relations ci-dessus constituent le modèle conceptuel de référence. Les cardinalités et contraintes précises seront détaillées lors de la conception logique et physique de la base de données.

### 6.5. Gestion de l'historique et de la provenance des données

Les données importantes de PEST AI OS devront conserver leur historique et leur provenance.

Pour les entités concernées, les informations suivantes devront être disponibles :

- Identifiant unique.
- Organisation de rattachement, lorsque nécessaire.
- Auteur ou source de création.
- Date de création.
- Date de dernière modification.
- Statut.
- Historique des modifications lorsque nécessaire.

Les données générées par l'IA devront également conserver le modèle, sa version, la date de traitement et les résultats associés.

Les changements d'affectation des producteurs, des parcelles et des utilisateurs devront être historisés.

### 6.6. Sécurité et cloisonnement des données

La base de données devra respecter le modèle multi-organisations de PEST AI OS.

Les règles de sécurité devront garantir :

- L'accès uniquement aux données autorisées.
- Le cloisonnement des informations entre organisations.
- La gestion des rôles et permissions.
- La traçabilité des opérations sensibles.
- La protection des données personnelles et agricoles.
- Le contrôle des accès des partenaires externes.
- La révocation des autorisations lorsqu'un accès n'est plus valide.

Les utilisateurs professionnels, notamment les agronomes, pourront intervenir dans plusieurs organisations uniquement lorsque les autorisations nécessaires leur auront été accordées.

### 6.7. Priorisation : MVP et évolutions futures

L'architecture globale est conçue pour couvrir la vision complète de PEST AI OS. Cependant, toutes les fonctionnalités ne seront pas nécessairement développées dès le MVP.

**Priorité MVP :**

- Organisations, utilisateurs et gestion des accès.
- Producteurs et agents.
- Parcelles et AgroID.
- Unités de culture et cycles agricoles.
- Missions et visites terrain.
- Observations et diagnostics.
- Recommandations agronomiques.
- Opérations agricoles et récoltes.
- Premières données satellitaires.
- SFA et constitution des dossiers agricoles.
- Notifications essentielles.
- Fonctionnement hors connexion et synchronisation.

**Évolutions progressives :**

- Gestion avancée des programmes et campagnes.
- Multiplication des modèles et services IA.
- Analyses satellitaires avancées.
- Intégration étendue des capteurs IoT.
- Connexion aux banques et compagnies d'assurance.
- Catalogue complet des fournisseurs.
- Commandes groupées et espace fournisseur avancé.
- Intégration des paiements.
- Automatisation avancée des notifications et des processus.

Cette priorisation ne signifie pas que les domaines futurs seront ignorés dans la conception. Les choix structurants devront permettre leur intégration sans refonte majeure.

### 6.8. Technologies associées

Les technologies de référence pour la mise en œuvre de cette architecture sont :

- **PostgreSQL** : stockage relationnel principal.
- **PostGIS** : stockage et traitement des données géospatiales.
- **Django ORM** : définition et gestion des modèles de données.
- **Django REST Framework** : exposition des données à travers les API.
- **Redis et Celery** : traitements asynchrones et tâches en arrière-plan.

La structure détaillée des tables, les champs, les contraintes, les index et les migrations seront définis dans le domaine de conception de la base de données et lors du développement backend.

### 6.9. Statut de cette spécification

Cette section constitue la référence conceptuelle de l'architecture des données de PEST AI OS.

Elle définit les principaux domaines fonctionnels, les entités structurantes et leurs relations.

Elle ne constitue pas encore le schéma physique définitif de PostgreSQL. Celui-ci sera élaboré progressivement pendant la conception technique et le développement du backend.
