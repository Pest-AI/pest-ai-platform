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


## 7. Architecture des API

### 7.1. Objectifs

L'architecture des API de PEST AI OS définit les mécanismes de communication entre les applications clientes, le backend et les services externes.

Elle doit permettre :

- L'accès centralisé aux fonctionnalités de PEST AI OS.
- La communication entre les applications web et mobiles et le backend.
- La gestion des utilisateurs, organisations et permissions.
- L'accès sécurisé aux données agricoles et géospatiales.
- L'intégration des services d'intelligence artificielle.
- La synchronisation des données hors connexion.
- La communication avec les partenaires et services externes.
- L'évolution progressive de la plateforme sans rupture majeure.

### 7.2. Architecture générale

PEST AI OS reposera sur une architecture API centralisée.

Les applications web et mobiles communiqueront avec le backend à travers les API. Le backend sera responsable de l'authentification, des autorisations, de la logique métier, de l'accès aux données et de l'orchestration des services.

Les applications ne devront jamais accéder directement à la base de données.

Les principaux composants seront :

- Applications web React et TypeScript.
- Applications mobiles React Native et Expo.
- API Backend Django REST Framework.
- Base PostgreSQL avec PostGIS.
- Services d'intelligence artificielle.
- Redis et Celery pour les traitements asynchrones.
- Stockage objet compatible S3.
- Connecteurs vers les services externes.

### 7.3. Style architectural et versionnement

PEST AI OS utilisera une architecture REST centralisée, avec des API versionnées.

La première version sera accessible à travers le préfixe :

`/api/v1/`

Exemples :

- `/api/v1/auth/`
- `/api/v1/organizations/`
- `/api/v1/producers/`
- `/api/v1/parcels/`
- `/api/v1/diagnostics/`
- `/api/v1/recommendations/`
- `/api/v1/orders/`

Le versionnement permettra de faire évoluer les API sans imposer immédiatement une modification de toutes les applications clientes.

Les changements incompatibles devront être gérés à travers une nouvelle version.

### 7.4. Organisation des endpoints

Les endpoints seront organisés selon les domaines fonctionnels de PEST AI OS.

| Domaine | Préfixe |
|---|---|
| Authentification | `/api/v1/auth/` |
| Organisations | `/api/v1/organizations/` |
| Utilisateurs et accès | `/api/v1/users/` |
| Producteurs | `/api/v1/producers/` |
| Parcelles AgroID | `/api/v1/parcels/` |
| Unités de culture | `/api/v1/cultivation-units/` |
| Cycles agricoles | `/api/v1/crop-cycles/` |
| Programmes | `/api/v1/programs/` |
| Campagnes | `/api/v1/campaigns/` |
| Missions terrain | `/api/v1/missions/` |
| Observations | `/api/v1/observations/` |
| Diagnostics | `/api/v1/diagnostics/` |
| Recommandations | `/api/v1/recommendations/` |
| Données satellitaires | `/api/v1/satellite/` |
| IoT et capteurs | `/api/v1/iot/` |
| SFA | `/api/v1/sfa/` |
| Finance et assurance | `/api/v1/finance/` |
| Fournisseurs | `/api/v1/suppliers/` |
| Produits agricoles | `/api/v1/products/` |
| Commandes | `/api/v1/orders/` |
| Notifications | `/api/v1/notifications/` |
| Synchronisation | `/api/v1/sync/` |

Cette organisation constitue une structure fonctionnelle de référence. Les endpoints détaillés seront définis pendant le développement de chaque domaine.

### 7.5. Authentification et gestion des sessions

L'authentification reposera sur des JSON Web Tokens (JWT).

Le mécanisme comprendra :

- `Access Token` : jeton temporaire utilisé pour accéder aux API protégées.
- `Refresh Token` : jeton permettant de renouveler une session.
- Révocation des sessions lorsqu'un compte ou un accès doit être désactivé.
- Gestion des sessions adaptée aux applications web et mobiles.

La durée de validité des jetons, leur stockage et leur renouvellement seront définis dans la spécification de sécurité.

Les mécanismes de session devront tenir compte des utilisateurs qui interviennent dans plusieurs organisations.

### 7.6. Gestion des rôles et autorisations

Chaque requête vers une ressource protégée devra faire l'objet de vérifications d'accès.

Le backend devra vérifier :

1. L'identité de l'utilisateur.
2. L'organisation dans laquelle il intervient.
3. Son rôle et ses permissions.
4. Le périmètre des données auquel il peut accéder.
5. L'autorisation d'effectuer l'action demandée.

Les contrôles devront être appliqués côté serveur, même lorsque les applications clientes masquent certaines fonctionnalités.

Un utilisateur d'une organisation ne devra pas pouvoir consulter ou modifier les données privées d'une autre organisation en manipulant simplement un identifiant ou une URL.

Les accès des agronomes, partenaires financiers, fournisseurs et autres acteurs externes devront également respecter leurs périmètres d'autorisation.

### 7.7. Format des échanges

Le format JSON sera utilisé comme standard des échanges entre les applications clientes et les API.

Les réponses devront être structurées et cohérentes.

Les API devront notamment prévoir :

- Des codes HTTP adaptés.
- Des messages d'erreur compréhensibles.
- Une structure de réponse standardisée.
- La pagination des résultats volumineux.
- La validation des données reçues.
- La gestion des filtres et des paramètres de recherche.

Les échanges de fichiers binaires utiliseront des mécanismes adaptés, notamment les requêtes multipart ou les URL de transfert sécurisées.

### 7.8. Gestion des fichiers et médias

Les fichiers et médias seront conservés dans un stockage objet sécurisé compatible S3, avec Cloudflare R2 comme solution envisagée.

Le backend sera responsable de la validation et du contrôle des accès.

La base PostgreSQL conservera les métadonnées et les références des fichiers.

Les mécanismes à prévoir comprennent :

- Vérification des types et formats autorisés.
- Limitation de la taille des fichiers.
- Compression et optimisation des images.
- Contrôle des autorisations.
- Accès temporaire sécurisé aux fichiers.
- Conservation des métadonnées et de la provenance.
- Accès contrôlé des services IA aux fichiers nécessaires.

Les images de cultures, les documents agricoles, les photographies de parcelles et les pièces justificatives devront être pris en charge.

### 7.9. Synchronisation Offline-first

Les API devront prendre en charge le fonctionnement hors connexion des applications mobiles.

Les applications devront pouvoir enregistrer localement les opérations réalisées sans accès à Internet, puis les transmettre au backend lorsque la connexion sera disponible.

La synchronisation devra gérer :

- Les opérations en attente.
- Les identifiants uniques générés côté mobile.
- Les nouvelles tentatives de transmission.
- La détection des doublons.
- La validation des autorisations.
- La détection des conflits.
- La confirmation de réception par le serveur.

Les conflits devront être identifiés et traités selon des règles définies. Aucune modification importante ne devra être écrasée silencieusement.

La synchronisation devra notamment couvrir les missions, visites, observations, informations AgroID, opérations agricoles et médias associés.

### 7.10. Intégration des services externes

Les échanges avec les services externes seront centralisés dans le backend à travers des connecteurs dédiés.

Les intégrations envisagées comprennent :

- Services satellitaires.
- Services météorologiques.
- Modèles et services d'intelligence artificielle.
- Services SMS et e-mail.
- Banques et compagnies d'assurance.
- Fournisseurs d'intrants agricoles.
- Services de paiement, notamment Wave et Orange Money dans une évolution future.

Les applications web et mobiles ne devront pas dépendre directement des interfaces techniques de chaque prestataire.

Cette approche facilitera le remplacement d'un fournisseur ou l'ajout d'un nouveau service.

### 7.11. Traitements asynchrones

Les opérations longues seront exécutées en arrière-plan afin de ne pas bloquer les applications clientes.

Les technologies de référence seront :

- Celery pour l'exécution des tâches.
- Redis comme système de gestion de file d'attente et de coordination.

Les traitements concernés pourront inclure :

- Analyses d'images agricoles.
- Analyses satellitaires.
- Calculs SFA.
- Génération de rapports.
- Traitements de données volumineuses.
- Opérations déclenchées après synchronisation.

Chaque traitement devra disposer d'un identifiant et d'un état de suivi : en attente, en cours, terminé ou échoué.

Les résultats pourront être communiqués aux utilisateurs par les API et les notifications.

### 7.12. Documentation et tests

Les API devront être documentées à l'aide du standard OpenAPI, avec une interface de consultation et de test telle que Swagger UI.

La documentation devra présenter :

- Les endpoints disponibles.
- Les paramètres attendus.
- Les formats de requête et de réponse.
- Les mécanismes d'authentification.
- Les règles d'autorisation.
- Les codes d'erreur.
- Les exemples d'utilisation.

Des tests automatisés devront être développés pour vérifier le comportement des API.

Les tests devront notamment couvrir :

- Authentification et gestion des sessions.
- Permissions et cloisonnement multi-organisations.
- Création et modification des données.
- Parcelles et géométries.
- Observations et diagnostics.
- Recommandations.
- Commandes et fournisseurs.
- Synchronisation mobile.
- Gestion des erreurs et des accès non autorisés.

### 7.13. Sécurité et fiabilité

L'architecture devra intégrer des mécanismes de sécurité adaptés à une plateforme multi-organisations.

Les mesures à prévoir comprennent :

- Validation systématique des données reçues.
- Contrôle des autorisations côté serveur.
- Protection des jetons et des sessions.
- Limitation des requêtes lorsque nécessaire (rate limiting).
- Journalisation des opérations sensibles.
- Protection contre les accès non autorisés.
- Gestion sécurisée des secrets et clés d'API.
- Surveillance des erreurs et des performances.
- Protection des interfaces destinées aux partenaires externes.

Les API devront être conçues pour gérer les erreurs réseau, les interruptions de service et les nouvelles tentatives sans créer de doublons ou de pertes de données.

### 7.14. Technologies de référence

Les technologies retenues pour l'architecture des API sont :

- **Django** : framework backend.
- **Django REST Framework** : développement des API REST.
- **JWT** : authentification par jetons.
- **JSON** : format standard des échanges.
- **PostgreSQL et PostGIS** : stockage des données.
- **Celery et Redis** : traitements asynchrones.
- **Cloudflare R2 ou stockage compatible S3** : stockage des fichiers.
- **OpenAPI / Swagger** : documentation des API.

### 7.15. Statut de cette spécification

Cette section définit l'architecture de référence des API de PEST AI OS.

Elle établit les principes de communication, d'authentification, d'autorisation, de synchronisation et d'intégration.

Elle ne constitue pas encore une documentation exhaustive de tous les endpoints. Ceux-ci seront spécifiés progressivement au cours du développement des différents modules backend.



## 8. Architecture de sécurité

### 8.1. Principes généraux

PEST AI OS adopte une architecture de sécurité multicouche. Chaque composant contribue à protéger les utilisateurs, les organisations, les données agricoles et les services de la plateforme.

La sécurité repose sur plusieurs niveaux :
- Application : authentification et contrôle des accès.
- Backend : vérification des rôles et autorisations.
- Base de données : isolation des données entre organisations.
- Stockage : protection des fichiers et documents.
- Infrastructure : protection des serveurs, secrets et communications.
- Traçabilité : journalisation des événements importants.

### 8.2. Protection des comptes utilisateurs

- Stockage des mots de passe sous forme de hash sécurisé, jamais en clair.
- Politique de mots de passe robustes.
- Limitation des tentatives de connexion.
- Réinitialisation sécurisée des mots de passe.
- Gestion des sessions, déconnexion et révocation des accès.
- Authentification à deux facteurs (2FA) obligatoire pour les superadministrateurs et recommandée pour les autres comptes sensibles.

### 8.3. Chiffrement des données

Deux niveaux de chiffrement sont prévus :

**Chiffrement en transit :**
- Utilisation obligatoire de HTTPS/TLS pour les communications entre les applications, les API et les serveurs.

**Chiffrement au repos :**
- Protection des données sensibles stockées dans la base de données.
- Chiffrement des sauvegardes.
- Protection des fichiers, photos et documents stockés.

La gestion des clés de chiffrement devra être sécurisée et séparée des données protégées.

### 8.4. Isolation des données entre organisations

PEST AI OS doit garantir une séparation stricte des données entre les organisations.

- Une organisation ne peut accéder qu'aux données auxquelles elle est autorisée.
- Les administrateurs d'une organisation ne peuvent pas modifier les données d'une autre organisation.
- Les agronomes intervenant dans plusieurs organisations disposent uniquement des accès explicitement accordés.
- PEST AI conserve un rôle de superadministrateur avec une visibilité globale encadrée.

Le contrôle des autorisations est effectué côté serveur à chaque opération. L'identifiant d'organisation transmis par le client ne constitue jamais, à lui seul, une preuve d'autorisation.

### 8.5. Protection des données agricoles et personnelles

Les principes suivants sont retenus :
- Collecter uniquement les informations nécessaires.
- Limiter l'accès aux données selon les rôles et autorisations.
- Encadrer le partage avec les banques, assurances et partenaires externes, notamment par le consentement lorsque celui-ci est requis.
- Enregistrer les accès et modifications portant sur les données sensibles.
- Définir des règles de conservation et de suppression des données.

### 8.6. Sécurité mobile et fonctionnement hors ligne

L'application mobile doit rester sécurisée même sans connexion Internet.

- Protection des données enregistrées localement sur les appareils.
- Limitation de la conservation des informations sensibles.
- Protection des photos et documents collectés.
- Synchronisation sécurisée dès le retour de la connexion.
- Gestion de la déconnexion et révocation des accès en cas de perte ou de vol d'un appareil.
- Contrôle des accès lors des changements de compte ou d'organisation.

### 8.7. Sauvegardes et récupération des données

La stratégie de sauvegarde comprend :
- Des sauvegardes automatiques et régulières de PostgreSQL.
- Des sauvegardes des fichiers et documents.
- Un stockage séparé du serveur principal.
- Une politique de conservation des sauvegardes.
- Des tests réguliers de restauration pour vérifier leur intégrité et leur exploitabilité.

### 8.8. Surveillance et journalisation des événements

La plateforme conserve des traces des opérations importantes, notamment :
- Connexions et déconnexions.
- Création, modification et suppression de données.
- Gestion des parcelles et producteurs.
- Création et validation des diagnostics.
- Consultation et partage de documents sensibles.
- Gestion des commandes fournisseurs.
- Modification des rôles et autorisations.

Les journaux doivent être protégés contre les modifications non autorisées et permettre d'identifier l'auteur, la date et la nature des opérations.

### 8.9. Gestion des incidents de sécurité

Une procédure de gestion des incidents est prévue :
- Détection des activités suspectes.
- Blocage temporaire des comptes compromis.
- Révocation des sessions et jetons d'accès.
- Identification des données potentiellement exposées.
- Restauration des données si nécessaire.
- Information des personnes et organisations concernées selon les obligations applicables.
- Documentation de l'incident et des mesures correctives.

### 8.10. Protection des API

Les API de PEST AI OS doivent intégrer :
- Une vérification des autorisations pour chaque requête.
- Une limitation du nombre de requêtes (rate limiting).
- Une validation des données reçues.
- Une protection des connexions avec les services externes.
- Une gestion sécurisée des clés et secrets techniques.
- Une surveillance des tentatives d'accès anormales.

Aucun secret technique ne doit être exposé dans le frontend ou l'application mobile.

### 8.11. Tests et maintenance de la sécurité

La sécurité est vérifiée tout au long du développement et de l'exploitation :
- Tests réguliers de sécurité.
- Vérification de l'isolation entre organisations.
- Mise à jour des frameworks et dépendances.
- Contrôles avant chaque mise en production.
- Tests spécifiques des droits d'accès et des protections des données.

Les mécanismes détaillés de mise en œuvre seront précisés dans les phases de développement et de déploiement.


## 9. Architecture de déploiement et infrastructure

### 9.1. Environnements de déploiement

PEST AI OS disposera de trois environnements distincts :

**Développement (Development)**
- Utilisé par les développeurs pour construire et tester les fonctionnalités.
- Permet de vérifier les modifications avant leur validation.

**Préproduction (Staging)**
- Reproduit autant que possible les conditions de production.
- Permet de tester les nouvelles versions avant leur publication.
- Sert à effectuer les vérifications fonctionnelles et techniques.

**Production (Production)**
- Correspond à l'environnement réel utilisé par les organisations, producteurs, agents, agronomes et partenaires.
- Héberge la version officiellement disponible de PEST AI OS.

Les environnements doivent être isolés, notamment au niveau des bases de données, des configurations et des secrets techniques.

### 9.2. Hébergement et infrastructure cloud

PEST AI OS adoptera une infrastructure cloud managée, modulaire et évolutive.

L'orientation initiale comprend :

- Frontend web : Vercel ou service équivalent.
- Backend Django et API : Render ou service équivalent.
- Base de données : PostgreSQL avec PostGIS sur une offre managée.
- Stockage des fichiers : Cloudflare R2 ou stockage compatible S3.
- Traitements en arrière-plan : Celery et Redis.

Les fournisseurs définitifs seront choisis après vérification de la compatibilité technique, des coûts, des performances, de la disponibilité, des sauvegardes et de la localisation des données.

L'infrastructure doit permettre de faire évoluer chaque composant indépendamment.

### 9.3. Automatisation des déploiements (CI/CD)

PEST AI OS adoptera un processus d'intégration et de déploiement continus (CI/CD) connecté à GitHub.

Le processus cible comprend :
1. Publication du code sur GitHub.
2. Exécution automatique des vérifications et tests.
3. Déploiement dans l'environnement de développement.
4. Validation en préproduction.
5. Autorisation et déploiement en production.

Les déploiements en production devront être contrôlés et traçables.

### 9.4. Surveillance de l'infrastructure

Une solution de monitoring permettra de suivre :
- Disponibilité de la plateforme.
- Performances du backend et des API.
- État de la base de données.
- Utilisation du stockage.
- Erreurs techniques.
- État des tâches Celery.
- Consommation des ressources serveur.

Des alertes automatiques seront prévues pour signaler les anomalies importantes aux responsables techniques.

### 9.5. Évolutivité de l'infrastructure

L'infrastructure devra accompagner la croissance de PEST AI OS sans nécessiter une reconstruction complète.

Les principes retenus sont :
- Augmentation verticale des ressources lorsque nécessaire.
- Mise à l'échelle horizontale du backend.
- Capacité indépendante de traitement pour les tâches IA, satellitaires et de synchronisation.
- Stockage extensible pour les photos, documents et données géographiques.
- Surveillance de la charge et anticipation des besoins.

### 9.6. Gestion des coûts cloud

La maîtrise des coûts constitue un principe important de l'infrastructure.

Les mécanismes prévus comprennent :
- Suivi des coûts par service.
- Alertes en cas de dépassement des seuils budgétaires.
- Surveillance de la consommation de stockage et de calcul.
- Optimisation des traitements IA et satellitaires.
- Suppression des ressources inutilisées.
- Adaptation du budget à la croissance de la plateforme.

L'objectif est de maintenir une infrastructure fiable et évolutive tout en maîtrisant les dépenses.


## 10. Architecture de l'application mobile

### 10.1. Architecture générale

PEST AI OS disposera d'une application mobile unique développée avec React Native et Expo.

Cette application proposera plusieurs espaces de travail adaptés aux profils et aux autorisations des utilisateurs.

Les principaux espaces prévus sont :
- Espace Producteur.
- Espace Agent terrain.
- Espace Agronome, selon les fonctionnalités mobiles autorisées.
- Espaces complémentaires selon les besoins opérationnels.

L'interface et les fonctionnalités accessibles seront adaptées au rôle et au contexte de travail de chaque utilisateur.

### 10.2. Gestion des utilisateurs et des rôles

L'application prendra en charge plusieurs profils :

- Producteur : consultation et gestion de ses parcelles, cultures, activités et observations.
- Agent terrain : missions, visites, collecte de données et enregistrement des parcelles.
- Agronome : consultation des observations, diagnostics et interventions autorisées.
- Administrateur d'organisation : gestion des fonctionnalités autorisées de son organisation.
- Superadministrateur PEST AI : administration globale selon ses permissions.

Un utilisateur pourra posséder plusieurs rôles et appartenir à plusieurs organisations.

Le changement d'organisation ou d'espace de travail devra être possible sans déconnexion. Les autorisations seront adaptées automatiquement au contexte actif.

### 10.3. Fonctionnement hors ligne (Offline-first)

L'application devra permettre aux utilisateurs de travailler même en l'absence de connexion Internet.

Les principes retenus sont :
- Conservation locale des données nécessaires aux activités.
- Possibilité de créer et modifier des informations hors ligne.
- Enregistrement temporaire des photos et documents.
- Synchronisation automatique au retour de la connexion.
- Attribution d'identifiants uniques aux opérations mobiles.
- Détection et gestion des conflits de synchronisation.
- Absence d'écrasement silencieux des données.

L'application affichera les différents états de synchronisation : en ligne, hors ligne, synchronisation en cours, synchronisé et erreur de synchronisation.

### 10.4. Navigation mobile

La navigation sera simple et adaptée aux usages de terrain.

**Espace Producteur :**
- Accueil.
- Mes parcelles.
- Activités.
- Conseils et observations.
- Profil.

**Espace Agent terrain :**
- Accueil.
- Mes missions.
- Parcelles AgroID.
- Collecte terrain.
- Profil.

Les fonctionnalités complémentaires seront accessibles depuis les écrans concernés afin de limiter la surcharge de navigation.

### 10.5. Collecte des données agricoles

L'application permettra de collecter les données agricoles directement sur le terrain.

Les catégories principales sont :
- Parcelles : coordonnées GPS, contours, superficie et identité AgroID.
- Producteurs : informations et rattachements organisationnels.
- Cultures : types, variétés et cycles agricoles.
- Activités : irrigation, fertilisation, traitements et récoltes.
- Observations : problèmes constatés, état des cultures, photos et commentaires.
- Visites : informations recueillies pendant les interventions.

L'agent terrain pourra dessiner les polygones des parcelles directement sur une carte mobile ou enregistrer leurs contours à l'aide du GPS.

**Répartition des responsabilités :**

- Le producteur déclare ses cultures, activités, récoltes et problèmes rencontrés.
- L'agent terrain collecte les informations, réalise les relevés GPS, crée les parcelles et effectue les visites.
- L'agronome examine les informations techniques, réalise ou valide les diagnostics selon ses autorisations.

La parcelle AgroID constitue le point central de rattachement des informations agricoles.

Les données collectées disposeront d'un statut de qualité :
- Brouillon.
- À vérifier.
- Validée.

### 10.6. Gestion des photos et documents

L'application permettra de prendre des photos directement depuis le téléphone ou d'importer des images existantes.

Les photos pourront être associées à une parcelle AgroID, une observation, un diagnostic, une visite ou une activité agricole.

Lorsque les informations sont disponibles, les métadonnées suivantes seront enregistrées :
- Date et heure de prise de vue.
- Position GPS.
- Utilisateur ayant effectué la collecte.
- Parcelle AgroID associée.

Les fichiers seront protégés localement et synchronisés de manière sécurisée vers le stockage distant.

### 10.7. Notifications et assistant agricole

L'application disposera d'un système de notifications personnalisé selon le rôle et le contexte de chaque utilisateur.

**Producteur :**
- Alertes météorologiques.
- Conseils culturaux personnalisés.
- Alertes phytosanitaires.
- Alertes intelligentes issues des données satellitaires et des observations.
- Rappels des activités agricoles.
- Recommandations agronomiques.
- Réponses aux observations et mises à jour des parcelles.

Un espace intitulé « Mon assistant agricole » centralisera les alertes, conseils et recommandations destinés au producteur.

Les informations seront personnalisées selon la localisation, les parcelles AgroID, les cultures, les cycles agricoles et les données environnementales disponibles.

Les alertes seront classées par niveau :
- Information.
- Attention.
- Critique.

Les recommandations devront être contextualisées et leur niveau de fiabilité clairement encadré. Les conseils nécessitant une expertise agronomique pourront faire l'objet d'une validation humaine.

**Agent terrain :**
- Nouvelles missions.
- Modifications de missions.
- Rappels de visites.
- Alertes de synchronisation.

**Agronome :**
- Diagnostics à examiner.
- Observations à valider.
- Demandes d'intervention.

Les notifications pourront être disponibles dans l'application, par notification push ou par SMS selon les besoins.

### 10.8. Langues et accessibilité

L'application devra être accessible aux producteurs ayant différents niveaux de maîtrise du numérique et de la lecture.

Les principes retenus sont :
- Interface en français.
- Assistance vocale en Wolof et en Pulaar avec Fary TTS.
- Possibilité d'écouter les conseils et recommandations.
- Messages simples et vocabulaire agricole compréhensible.
- Utilisation d'icônes et d'illustrations facilitant la compréhension.
- Interfaces adaptées aux utilisateurs peu familiarisés avec les applications numériques.

### 10.9. Performance et compatibilité mobile

L'application sera prioritairement optimisée pour Android, notamment les appareils d'entrée de gamme.

Les exigences comprennent :
- Compatibilité avec les appareils disposant de ressources limitées.
- Chargement progressif des images et des cartes.
- Compression des photos avant synchronisation.
- Réduction de la consommation de données mobiles.
- Interfaces rapides et légères.
- Conservation locale des données nécessaires au mode hors ligne.
- Synchronisation en arrière-plan lorsque les conditions le permettent.

### 10.10. Sécurité et confidentialité mobile

L'application mobile appliquera les principes de sécurité définis dans la section 8.

Les exigences comprennent :
- Authentification sécurisée.
- Protection des données enregistrées localement.
- Gestion des sessions et des appareils connectés.
- Contrôle des accès selon les rôles et autorisations.
- Protection des photos et documents.
- Déconnexion et révocation des accès en cas de perte ou de vol du téléphone.
- Synchronisation sécurisée avec le backend.

### 10.11. Architecture technique interne

L'application sera organisée en composants modulaires :

1. **Interface utilisateur :** gestion des écrans et espaces de travail.
2. **Gestion des données locales :** conservation des informations nécessaires au fonctionnement hors ligne.
3. **Moteur de synchronisation :** gestion des échanges entre les données locales et le serveur.
4. **Communication API :** échanges sécurisés avec le backend Django.
5. **Services du téléphone :** GPS, appareil photo, cartes et notifications.
6. **Sécurité locale :** gestion des sessions et protection des données enregistrées.

Cette organisation doit faciliter la maintenance, les tests et l'ajout de nouvelles fonctionnalités.

## 11. Architecture de l'intelligence artificielle (IA)

### 11.1. Principes généraux

L'intelligence artificielle constitue une composante centrale de PEST AI OS. Elle exploite les données agricoles, géospatiales, environnementales, satellitaires et opérationnelles afin de produire des analyses, des recommandations et des indicateurs utiles aux producteurs, agents de terrain, agronomes, organisations et partenaires autorisés.

L'architecture IA repose sur une approche modulaire, hybride, évolutive et traçable. Elle doit permettre d'intégrer différents modèles et services d'intelligence artificielle sans créer de dépendance technique à un fournisseur unique.

Les principaux domaines d'intelligence sont :

- Intelligence phytosanitaire : analyse des maladies et ravageurs à partir des observations et des images.
- Intelligence agronomique : assistance et recommandations adaptées aux cultures, cycles et conditions agricoles.
- Intelligence satellitaire : exploitation des données de télédétection pour surveiller les parcelles, la végétation, le stress hydrique et les anomalies.
- Intelligence prédictive : estimation de risques et anticipation de certaines situations agricoles.
- Intelligence vocale : assistance et accessibilité linguistique, notamment à travers Fary TTS pour le Wolof et le Pulaar.
- Intelligence agricole et financière : exploitation des données agricoles fiables et traçables pour alimenter le SFA et les outils d'aide à l'évaluation des risques.

Fary TTS constitue une composante d'interaction vocale et d'accessibilité. Il ne remplace pas les moteurs d'analyse et de décision agricole.

### 11.2. Architecture générale des modèles IA

PEST AI OS adopte une architecture composée de plusieurs modèles et services spécialisés, coordonnés par une couche centrale d'orchestration IA.

Les principales composantes sont :

- Modèles phytosanitaires.
- Modèles d'assistance agronomique.
- Modèles d'analyse satellitaire et géospatiale.
- Modèles prédictifs.
- Services de traitement et d'interaction vocale.
- Services d'analyse et d'aide à l'évaluation agricole et financière.

PEST AI Cloud assure la collecte, la préparation, le nettoyage, l'enrichissement et la mise à disposition des données nécessaires aux traitements IA.

La couche d'orchestration IA assure notamment la sélection des modèles, la gestion des traitements, le suivi des analyses, la traçabilité des résultats et leur transmission aux modules concernés de PEST AI OS.

Les modèles doivent pouvoir évoluer indépendamment afin de faciliter leur remplacement, leur amélioration ou l'intégration de nouvelles capacités.

### 11.3. Stratégie hybride et déploiement progressif

PEST AI adopte une stratégie hybride combinant :

- Des services IA externes, notamment des modèles proposés par OpenAI, lorsque leur utilisation apporte une valeur pertinente.
- Des modèles préentraînés pouvant être adaptés aux cultures, aux langues et aux réalités agricoles locales.
- Des modèles développés ou entraînés par PEST AI lorsque la disponibilité et la qualité des données le permettent.

Les services externes sont utilisés à travers le backend et les connecteurs sécurisés de PEST AI. Les clés d'accès et les données sensibles ne doivent jamais être exposées directement aux applications clientes.

Le développement de l'intelligence propriétaire de PEST AI se fera progressivement à partir des données agricoles collectées, vérifiées et enrichies sur le terrain.

### 11.4. Cultures prioritaires du MVP

Le MVP démarre avec un périmètre agricole volontairement limité à cinq cultures prioritaires dans la Vallée du fleuve Sénégal :

1. Riz.
2. Oignon.
3. Tomate.
4. Maïs.
5. Piment.

Ce choix initial permet de concentrer les efforts de développement, de collecte de données et de validation agronomique sur un nombre maîtrisable de cultures.

Les capacités et connaissances des modèles doivent tenir compte des zones agroécologiques, des variétés, des cycles culturaux, des conditions climatiques et des pratiques agricoles.

La liste des cultures et les priorités pourront évoluer en fonction des résultats du MVP, des besoins des organisations partenaires et de la disponibilité des données.

### 11.5. Capacités IA initiales du MVP

Le socle IA initial repose sur trois capacités principales.

**A. Diagnostic phytosanitaire**

- Analyse des photographies et observations de terrain.
- Identification de symptômes et proposition d'hypothèses de maladies ou de ravageurs.
- Prise en compte de la culture et du contexte de la parcelle.
- Présentation des résultats, des éléments justificatifs et des limites de l'analyse.
- Transmission à un agronome pour validation lorsque nécessaire.

**B. Assistance agronomique**

- Recommandations contextualisées selon la culture et le cycle cultural.
- Accompagnement des principales étapes de production.
- Exploitation des données de terrain, des conditions environnementales et des informations disponibles.
- Production de conseils compréhensibles et adaptés aux utilisateurs.

**C. Surveillance agricole**

- Exploitation des données satellitaires et météorologiques.
- Suivi de l'évolution de la végétation et des conditions des parcelles.
- Détection d'anomalies et de situations nécessitant une attention particulière.
- Production d'alertes et d'informations utiles aux producteurs et aux équipes techniques.

Les analyses satellitaires et les prédictions devront tenir compte des limites des données disponibles, de leur résolution, de leur fraîcheur et de leur validation locale.

### 11.6. Fiabilité, traçabilité et validation humaine

Chaque analyse IA doit être traçable et conserver, selon le type de traitement :

- Le modèle utilisé et sa version.
- Les données d'entrée et leur provenance.
- La date et le statut du traitement.
- Le résultat généré.
- Le niveau de confiance lorsqu'il est disponible et correctement calibré.
- Les éléments justificatifs et les limites connues.
- Le statut de validation humaine.
- L'identité de l'intervenant ayant confirmé, corrigé ou rejeté le résultat.

Les résultats IA constituent des propositions d'analyse et ne doivent pas être automatiquement considérés comme des vérités agronomiques.

Les agronomes autorisés peuvent confirmer, corriger ou rejeter les résultats. Ils peuvent également produire directement un diagnostic ou une recommandation sans intervention préalable de l'IA.

Le système doit conserver l'historique des résultats initiaux, des corrections et des validations.

### 11.7. Amélioration continue des modèles

PEST AI OS doit disposer d'un mécanisme d'amélioration continue de ses capacités IA.

Les principales sources d'amélioration comprennent :

- Les observations collectées par les agents de terrain.
- Les diagnostics confirmés et corrigés par les agronomes.
- Les recommandations et leurs résultats de suivi.
- Les données de production et de récolte.
- Les données météorologiques et satellitaires.
- Les historiques des activités agricoles et des cycles culturaux.

Ces données peuvent servir à constituer des jeux de données de référence, évaluer les modèles, adapter leurs performances et développer progressivement des modèles propriétaires.

Aucune modification automatique d'un modèle en production ne doit être réalisée sur la seule base de nouvelles observations.

Toute nouvelle version doit faire l'objet de tests, d'une évaluation de performance, d'une validation et d'un déploiement contrôlé.

L'architecture doit également permettre de surveiller les performances des modèles, de détecter leur dégradation et de revenir à une version précédente si nécessaire.

### 11.8. Protection et maîtrise des données

PEST AI conserve la maîtrise de son infrastructure de données agricoles et encadre l'utilisation des services IA externes.

Les principes suivants s'appliquent :

- Protection des données des producteurs, organisations et parcelles.
- Minimisation des données transmises aux fournisseurs externes.
- Anonymisation ou pseudonymisation lorsque cela est pertinent.
- Transmission sécurisée des données nécessaires aux traitements.
- Contrôle des accès et des autorisations.
- Traçabilité des échanges avec les services externes.
- Encadrement contractuel de l'utilisation, de la conservation et de la réutilisation des données par les fournisseurs.

Les services IA externes ne doivent pas disposer d'un accès libre à la base de données de PEST AI.

Les données agricoles constituent un actif stratégique de PEST AI et doivent être protégées conformément aux exigences de sécurité, de confidentialité et de gouvernance définies dans cette architecture.


## 12. Architecture géospatiale et cartographique

### 12.1. Principes généraux

L'architecture géospatiale constitue un composant central de PEST AI OS. Elle permet d'identifier, de représenter, de localiser et d'analyser les parcelles agricoles ainsi que les autres objets géographiques de la plateforme.

Chaque parcelle AgroID doit posséder une géométrie géographique précise représentant ses contours réels, et non uniquement un point GPS.

Cette géométrie constitue une référence spatiale pour les activités agricoles, les observations terrain, les analyses satellitaires, les indicateurs de production et les services d'intelligence agricole.

### 12.2. Technologies géospatiales

Les technologies de référence sont :

- PostgreSQL avec PostGIS pour le stockage, la validation et l'analyse des données géographiques.
- MapLibre pour l'affichage cartographique et l'interaction avec les cartes.
- GeoJSON comme format d'échange géographique courant.
- Des composants cartographiques adaptés aux interfaces Web et Mobile.

Les traitements géographiques doivent privilégier les calculs adaptés au système de coordonnées utilisé. Les superficies agricoles doivent être calculées dans un système de référence approprié afin d'obtenir des résultats cohérents.

### 12.3. Création et acquisition des parcelles

PEST AI OS doit proposer trois méthodes principales de création des géométries de parcelles :

**A. Dessin manuel**

Les utilisateurs autorisés peuvent dessiner les contours d'une parcelle directement sur la carte.

**B. Relevé GPS**

Les agents de terrain peuvent enregistrer les limites d'une parcelle en parcourant son périmètre avec un appareil mobile équipé d'un GPS.

**C. Importation géographique**

La plateforme doit permettre l'importation de données géographiques existantes, notamment GeoJSON et KML, sous réserve de validation et de compatibilité.

Quelle que soit la méthode utilisée, la géométrie doit être contrôlée avant sa validation définitive et son association à l'identifiant AgroID.

### 12.4. Visualisation cartographique multi-parcelles

La plateforme doit permettre de visualiser plusieurs parcelles simultanément sur une même carte.

Cette fonctionnalité est particulièrement importante pour les coopératives, les ONG, les programmes agricoles et les organisations disposant de plusieurs producteurs et parcelles.

Chaque parcelle pourra être représentée avec :

- Son contour géographique.
- Son identifiant AgroID.
- Sa superficie.
- Sa culture principale.
- Son producteur associé.
- Son statut de validation.

Les statuts cartographiques de référence sont :

- Validée.
- À vérifier.
- Brouillon.

La représentation visuelle doit permettre de distinguer facilement les différents statuts sans compromettre la lisibilité de la carte.

### 12.5. Filtres et exploration cartographique

Les utilisateurs autorisés doivent pouvoir filtrer et explorer les parcelles selon plusieurs critères :

- Culture.
- Producteur.
- Statut de validation.
- Campagne agricole.
- Programme agricole.
- Organisation.

La disponibilité des filtres et des données affichées dépend des rôles, des autorisations et du périmètre organisationnel de chaque utilisateur.

La sélection d'une parcelle doit permettre d'accéder à sa fiche AgroID et à ses principales informations géographiques et agricoles : producteur, superficie, culture, cycle cultural, activités et observations.

### 12.6. Intégration des données satellitaires

Chaque parcelle AgroID doit pouvoir être associée à un historique de données satellitaires.

La plateforme doit permettre d'exploiter notamment :

- Les images satellitaires disponibles.
- Le NDVI pour le suivi de la végétation.
- Le NDWI pour certaines analyses liées à l'eau et à l'humidité.
- Les indicateurs de végétation et de stress des cultures.
- Les anomalies observées au cours du temps.

Chaque observation satellitaire doit conserver sa date, sa source, les indicateurs calculés, les informations de qualité et les limites éventuelles des données.

Les analyses doivent tenir compte de la résolution spatiale, de la couverture nuageuse, de la fraîcheur des images et du contexte agronomique.

### 12.7. Alertes géospatiales

PEST AI OS doit pouvoir détecter des anomalies géospatiales à partir des données satellitaires et environnementales.

Exemples :

- Baisse inhabituelle d'un indice de végétation.
- Évolution anormale d'une zone cultivée.
- Stress hydrique potentiel.
- Variation importante entre plusieurs observations successives.

Ces anomalies peuvent générer des alertes destinées aux producteurs, agents ou agronomes selon leurs responsabilités et autorisations.

Une alerte géospatiale constitue un signal nécessitant éventuellement une vérification sur le terrain. Elle ne doit pas être automatiquement considérée comme un diagnostic phytosanitaire ou une confirmation de problème agricole.

### 12.8. Fonctionnement hors connexion

La gestion géographique des parcelles doit respecter le principe Offline-first défini pour l'application mobile.

Les agents autorisés doivent pouvoir :

- Consulter les parcelles précédemment synchronisées.
- Consulter les dernières données cartographiques disponibles localement.
- Enregistrer des contours GPS hors connexion.
- Créer ou modifier une fiche géographique localement.
- Conserver les relevés et les informations nécessaires à la synchronisation.
- Synchroniser les modifications lorsque la connexion Internet est rétablie.

La plateforme doit permettre la mise en cache préalable des fonds cartographiques et des données géographiques nécessaires aux missions de terrain, dans les limites des capacités de stockage des appareils.

Les mécanismes de synchronisation doivent respecter les règles de détection des conflits définies dans l'architecture mobile et API.

### 12.9. Contrôle et validation des géométries

Avant la validation définitive d'une parcelle AgroID, le système doit effectuer des contrôles automatiques.

Ces contrôles comprennent :

- Vérification de la fermeture des polygones.
- Vérification de la validité géométrique.
- Détection des auto-intersections et autres anomalies géométriques.
- Calcul et vérification de la superficie.
- Détection des chevauchements potentiels avec les parcelles existantes.
- Contrôle de la cohérence et de la qualité des coordonnées GPS.

Les anomalies doivent être signalées aux utilisateurs autorisés.

Un chevauchement ne doit pas entraîner un rejet automatique : il peut correspondre à une erreur de relevé ou à une situation foncière nécessitant une vérification.

La validation finale doit tenir compte des règles métier, des vérifications terrain et des autorisations applicables.

### 12.10. Exportation des données géographiques

PEST AI OS doit proposer des fonctions d'exportation pour les utilisateurs autorisés.

Les formats de référence comprennent :

- GeoJSON.
- KML.
- Shapefile.
- PDF cartographique.
- Excel pour les données descriptives associées aux parcelles.

Les exports doivent respecter les permissions organisationnelles, les règles de confidentialité et les restrictions d'accès aux données.

La génération des exports volumineux doit pouvoir être exécutée comme un traitement asynchrone.

### 12.11. Performance et évolutivité

L'architecture géospatiale doit pouvoir gérer progressivement un grand nombre de parcelles, de géométries et d'observations satellitaires.

Les principes suivants doivent être appliqués :

- Indexation spatiale avec PostGIS.
- Optimisation des requêtes géographiques.
- Chargement progressif des parcelles selon la zone affichée.
- Regroupement visuel des parcelles lorsque leur nombre devient important.
- Mise en cache des données cartographiques lorsque cela est pertinent.
- Séparation des traitements géospatiaux lourds et des opérations courantes de l'API.

L'architecture doit permettre d'étendre les capacités géospatiales sans remettre en cause l'identité numérique AgroID des parcelles.


## 13. Architecture IoT et capteurs agricoles

### 13.1. Principes généraux

PEST AI OS doit disposer d'une architecture IoT permettant d'intégrer des équipements connectés installés dans les parcelles agricoles, les zones de production et les infrastructures météorologiques.

Ces équipements permettent de collecter automatiquement des données environnementales et agricoles afin d'enrichir les informations associées aux parcelles AgroID et d'améliorer les capacités d'analyse et d'aide à la décision de la plateforme.

L'architecture doit être modulaire, interopérable, sécurisée et indépendante d'un fabricant unique.

### 13.2. Types de capteurs et équipements

La plateforme doit pouvoir intégrer différentes catégories d'équipements :

- Capteurs d'humidité du sol.
- Capteurs de température.
- Capteurs d'humidité de l'air.
- Capteurs de pluviométrie.
- Stations météorologiques.
- Capteurs de vent et de rayonnement solaire.
- Autres équipements environnementaux et agricoles compatibles.

Les mesures collectées doivent être associées à leur source, leur date, leur localisation, leur unité et leurs informations de qualité.

### 13.3. Systèmes d'irrigation intelligents

PEST AI OS doit prévoir la possibilité d'intégrer des systèmes d'irrigation connectés.

Selon les équipements et les autorisations disponibles, la plateforme pourra :

- Consulter l'état de fonctionnement des systèmes.
- Surveiller les conditions d'humidité du sol.
- Déclencher ou arrêter l'irrigation à distance.
- Programmer des cycles d'irrigation.
- Recevoir des alertes de panne ou d'anomalie.
- Conserver l'historique des commandes et des opérations d'irrigation.

Les commandes d'irrigation doivent respecter des règles de sécurité strictes, notamment les autorisations, les seuils configurés, les conditions de fonctionnement et les mécanismes de confirmation nécessaires.

Une recommandation ou une commande générée par l'IA ne doit jamais déclencher automatiquement une action physique sans les contrôles et autorisations prévus.

### 13.4. Protocoles de communication

L'architecture IoT doit être compatible avec plusieurs technologies de communication, selon les équipements et les conditions de déploiement :

- Wi-Fi.
- Bluetooth.
- LoRaWAN.
- Réseaux cellulaires 2G, 3G et 4G.
- Autres protocoles et passerelles compatibles.

LoRaWAN constitue notamment une option à étudier pour les zones agricoles étendues et les équipements nécessitant une faible consommation énergétique.

La plateforme doit privilégier une architecture multi-protocoles afin de faciliter l'intégration de différents fabricants et modèles de capteurs.

### 13.5. Gestion des équipements IoT

Chaque équipement connecté doit posséder une fiche individuelle dans PEST AI OS.

Cette fiche doit notamment contenir :

- Identifiant unique de l'équipement.
- Type d'équipement.
- Fabricant et modèle.
- Protocole de communication.
- Localisation géographique.
- Parcelle AgroID, zone agricole ou station associée.
- Date d'installation.
- État de fonctionnement.
- Historique des mesures.
- Historique de maintenance et des interventions.

Un équipement peut être associé à une parcelle, à plusieurs parcelles par l'intermédiaire d'une zone de couverture, à une zone agricole ou à une station météorologique.

La plateforme doit gérer les installations, déplacements, désinstallations et changements d'affectation des équipements.

### 13.6. Espace de gestion IoT des organisations

Les coopératives et les organisations autorisées doivent disposer d'un espace de gestion de leurs équipements IoT.

Cet espace doit permettre :

- La consultation des équipements installés.
- L'enregistrement de nouveaux équipements.
- Le suivi de leur état.
- La consultation des dernières mesures reçues.
- L'accès à l'historique des données.
- Le signalement des pannes.
- Le suivi des opérations de maintenance.

Les administrateurs de PEST AI disposent d'une visibilité globale sur les équipements de la plateforme, dans le respect des règles de sécurité et des périmètres organisationnels.

### 13.7. Alertes et notifications IoT

PEST AI OS doit pouvoir générer des alertes en fonction des mesures reçues et de règles configurées.

Exemples :

- Humidité du sol inférieure à un seuil défini.
- Température anormalement élevée.
- Capteur hors ligne depuis une durée définie.
- Niveau de batterie faible.
- Dysfonctionnement d'un système d'irrigation.
- Mesures incohérentes ou inhabituelles.

Les alertes doivent être contextualisées et transmises aux utilisateurs autorisés selon leurs responsabilités.

La plateforme doit également distinguer les alertes techniques concernant les équipements des alertes agricoles concernant les conditions de production.

### 13.8. Fusion des données agricoles

L'architecture doit permettre de croiser plusieurs sources de données :

- Données issues des capteurs IoT.
- Données satellitaires et géospatiales.
- Données météorologiques.
- Observations et relevés de terrain.
- Informations relatives aux cultures, cycles et activités agricoles.

Cette fusion permet de contextualiser les analyses et les recommandations.

Par exemple, une mesure de faible humidité du sol peut être analysée en tenant compte des prévisions météorologiques, du type de sol, de la culture, du stade de développement et des observations satellitaires disponibles.

Les résultats doivent tenir compte de la qualité, de la fraîcheur et de la fiabilité des différentes sources.

### 13.9. Historisation des mesures

PEST AI OS doit conserver un historique structuré des mesures collectées par chaque équipement.

Chaque mesure doit pouvoir être associée à :

- L'équipement source.
- La date et l'heure de collecte.
- Le type de mesure.
- La valeur et son unité.
- La localisation ou la zone associée.
- Les informations de qualité et de validité.
- Le statut de réception et de traitement.

L'historique doit permettre de comparer les mesures entre plusieurs périodes, d'étudier l'évolution des conditions agricoles, d'alimenter les modèles prédictifs et de contribuer aux analyses de performance agricole.

Les opérations de maintenance et les changements de configuration doivent également être historisés.

### 13.10. Architecture technique et traitement des données IoT

Les équipements transmettent leurs données à travers des passerelles ou connecteurs compatibles.

Le backend PEST AI assure la réception, l'authentification, la validation, le traitement et le stockage des données.

Les traitements asynchrones peuvent être utilisés pour les volumes importants de mesures, la génération d'alertes et les analyses complémentaires.

L'architecture doit prévoir la gestion des équipements temporairement hors ligne, les interruptions de communication, les mesures répétées et les retards de transmission.

Les mesures doivent conserver leur horodatage d'origine afin de distinguer le moment réel de collecte du moment de réception par la plateforme.

### 13.11. Sécurité et contrôle des équipements

Chaque équipement et passerelle doit être identifié et authentifié selon un mécanisme adapté.

Les communications doivent être sécurisées, les accès contrôlés et les commandes à distance protégées.

Les actions sensibles, notamment les commandes d'irrigation, doivent être autorisées, journalisées et vérifiables.

Les données et équipements doivent respecter les règles d'isolation organisationnelle et les principes de sécurité définis dans la présente architecture.

### 13.12. Évolutivité

L'architecture IoT doit permettre d'intégrer progressivement de nouveaux équipements, protocoles, fabricants et catégories de mesures.

Les premiers déploiements pourront se concentrer sur un nombre limité de capteurs et de zones pilotes avant une extension à plusieurs coopératives, programmes et territoires.

Les choix définitifs de matériels, de passerelles et de protocoles devront tenir compte des coûts, de la disponibilité locale, de la connectivité, de la consommation énergétique, de la maintenance et des conditions réelles d'exploitation.


## 14. Architecture des notifications et communications

### 14.1 Objectifs

L'architecture des notifications et communications de PEST AI OS vise à faciliter les échanges entre les producteurs, agents terrain, agronomes, responsables d'organisations, partenaires et administrateurs de la plateforme.

Elle doit garantir des communications adaptées aux rôles, aux autorisations, aux préférences et aux conditions de connectivité des utilisateurs.

### 14.2 Canaux de notification

PEST AI OS prendra en charge trois canaux complémentaires :

- Notifications dans l'application.
- Notifications push sur les appareils mobiles.
- Notifications par SMS et e-mail.

Le choix du canal dépendra de la nature du message, des préférences de l'utilisateur et des capacités techniques disponibles.

### 14.3 Personnalisation et niveaux de priorité

Chaque utilisateur pourra configurer ses préférences de notification selon son rôle et ses besoins.

Trois niveaux de priorité seront distingués :

- Information : informations générales et actualités.
- Attention : situation nécessitant une vigilance ou une action.
- Critique : situation présentant un risque important et nécessitant une notification prioritaire.

Les alertes critiques pourront bénéficier d'un traitement prioritaire, même lorsque certaines notifications habituelles sont désactivées. Leur déclenchement devra respecter des règles de pertinence et de contrôle afin d'éviter les alertes abusives.

### 14.4 Communications ciblées

Les organisations et les professionnels autorisés pourront communiquer avec leurs publics respectifs.

Exemples :
- Une coopérative communique avec ses producteurs membres.
- Une ONG transmet une annonce aux bénéficiaires de ses programmes.
- Un agronome échange des informations avec les producteurs qu'il accompagne.
- PEST AI transmet des communications générales aux utilisateurs concernés.

Chaque communication devra respecter le périmètre organisationnel et les permissions de l'émetteur.

### 14.5 Messagerie interne

Une messagerie interne sera intégrée à PEST AI OS afin de permettre les échanges entre les différents acteurs autorisés.

Elle pourra notamment permettre :
- Les échanges entre producteurs et agronomes.
- Les échanges entre agents terrain et responsables.
- Les échanges entre agronomes et coopératives.
- Les communications entre organisations et leurs membres.

La messagerie respectera les règles d'accès et d'isolation des organisations.

### 14.6 Pièces jointes

Les utilisateurs pourront partager dans leurs conversations :
- Des photographies.
- Des documents PDF.
- Des rapports et fiches agricoles.
- Des messages vocaux.

Les fichiers seront stockés dans le système de stockage sécurisé de la plateforme. Leur accès sera contrôlé selon les autorisations.

### 14.7 Intégration de Fary TTS et Fary ASR

PEST AI OS intégrera les technologies vocales Fary afin de faciliter les interactions multilingues.

**Fary TTS — Text-to-Speech**

Conversion du texte en voix pour permettre notamment :
- La lecture des messages.
- La lecture des recommandations agricoles.
- L'accès vocal aux informations de la plateforme.

**Fary ASR — Automatic Speech Recognition**

Reconnaissance vocale et conversion de la parole en texte pour permettre notamment :
- La dictée de messages.
- La transcription des messages vocaux.
- La collecte d'informations agricoles par la voix.

Les fonctionnalités vocales viseront notamment le français, le Wolof et le Pulaar, selon les capacités disponibles et leur niveau de qualité.

### 14.8 Traduction multilingue

La plateforme prévoira des fonctionnalités de traduction entre :
- Français et Wolof.
- Français et Pulaar.
- Wolof et Pulaar, lorsque la qualité de traduction sera suffisante.

Le message original devra être conservé. L'utilisateur pourra consulter sa traduction et être informé lorsque la traduction présente un niveau d'incertitude important.

### 14.9 Appels audio et vidéo

L'architecture prévoira la possibilité d'effectuer des appels audio et vidéo entre utilisateurs autorisés.

Ces fonctionnalités seront développées dans une version ultérieure, après la mise en place des fonctionnalités essentielles de messagerie.

### 14.10 Historique et traçabilité

Le système conservera un historique des communications comprenant notamment :
- L'expéditeur et les destinataires.
- La date et l'heure.
- L'organisation concernée.
- Le statut du message : envoyé, distribué ou lu, lorsque cette information est disponible.
- Les pièces jointes associées.

Les règles de conservation, de modification et de suppression des données seront définies en cohérence avec les exigences de sécurité et de confidentialité.

### 14.11 Fonctionnement hors connexion

Les communications devront tenir compte des conditions de connectivité des zones agricoles.

Le système devra notamment permettre :
- L'enregistrement local des messages rédigés hors connexion.
- La mise en attente des messages à envoyer.
- La synchronisation automatique au retour de la connexion.
- L'affichage des statuts : en attente, envoyé ou échec.
- La gestion des erreurs et des nouvelles tentatives d'envoi.

Les notifications non délivrées pourront être traitées à nouveau lorsque les conditions techniques le permettront.

### 14.12 Protection et modération

La messagerie intégrera des mécanismes de protection :
- Signalement de messages ou d'utilisateurs.
- Blocage d'utilisateurs lorsque cela est nécessaire.
- Limitation du spam et des messages indésirables.
- Traitement des signalements par les administrateurs habilités.

Les interventions administratives devront respecter le périmètre organisationnel et les permissions attribuées.

### 14.13 Confidentialité des communications

Les conversations privées seront accessibles uniquement à leurs participants autorisés.

Les administrateurs ne disposeront pas d'un accès libre et systématique à toutes les conversations privées.

L'examen d'un contenu signalé devra suivre une procédure contrôlée et être réservé aux personnes habilitées.

Les accès et interventions sensibles devront être encadrés et tracés lorsque nécessaire.

### 14.14 Principes techniques

L'architecture devra permettre :
- Une gestion centralisée des notifications.
- Un système de distribution multicanal.
- Une gestion des préférences et des priorités.
- Une messagerie sécurisée.
- L'intégration des services Fary TTS et Fary ASR.
- La prise en charge des traductions.
- La gestion des pièces jointes.
- La synchronisation hors connexion.
- La traçabilité des communications.
- Une architecture évolutive permettant l'ajout des appels audio et vidéo.

Les traitements asynchrones pourront s'appuyer sur Celery et Redis, conformément à la stack technique retenue.


## 15. Architecture de gestion des fichiers et documents

### 15.1 Objectifs

L'architecture de gestion des fichiers de PEST AI OS vise à centraliser, organiser, sécuriser, stocker et exploiter les fichiers et données associés aux activités agricoles.

Elle doit prendre en charge les documents classiques, les médias collectés sur le terrain ainsi que les données scientifiques et techniques utilisées par les différents modules de la plateforme.

### 15.2 Architecture de stockage

Les fichiers seront stockés dans un système de stockage objet indépendant de la base de données PostgreSQL.

Les solutions envisagées sont :
- Cloudflare R2.
- Un stockage compatible avec l'API Amazon S3.

PostgreSQL conservera les métadonnées, les références de stockage, les relations métier et les règles d'accès aux fichiers.

Cette séparation permettra de gérer des volumes importants sans alourdir la base de données relationnelle.

### 15.3 Organisation des fichiers par contexte métier

Chaque fichier devra être associé à son contexte métier lorsque cela est pertinent.

Exemples :
- Une photographie pourra être liée à une parcelle AgroID, une observation ou une visite terrain.
- Un document pourra être lié au dossier d'un producteur.
- Un rapport pourra être associé à une organisation ou à un programme agricole.
- Une image de diagnostic pourra être liée à une analyse IA et à ses éléments de preuve.

Cette organisation facilitera la recherche, la traçabilité et la gestion des autorisations.

### 15.4 Gestion des permissions

Les droits d'accès aux fichiers seront déterminés en fonction :
- Du rôle de l'utilisateur.
- De son organisation active.
- De ses autorisations spécifiques.
- Du contexte métier auquel le fichier est rattaché.
- Des éventuels consentements nécessaires.

Les producteurs, agents, agronomes, responsables d'organisations et administrateurs accéderont uniquement aux fichiers relevant de leurs permissions.

Le rôle de superadministrateur PEST AI sera également soumis aux règles de sécurité et de traçabilité.

### 15.5 Formats de fichiers pris en charge

Les formats initiaux envisagés sont :

| Catégorie | Formats |
|---|---|
| Images | JPG, JPEG, PNG, WEBP |
| Documents | PDF, DOCX, XLSX |
| Données géographiques | GeoJSON, KML, SHP (Shapefile) |
| Audio | MP3, WAV, M4A |
| Vidéo | MP4 |

Les formats acceptés seront contrôlés côté serveur. Les fichiers non autorisés ou non pris en charge seront rejetés.

### 15.6 Limites initiales de taille

Les limites initiales proposées sont :

| Catégorie | Taille maximale |
|---|---:|
| Images | 10 Mo |
| Documents PDF et bureautiques | 25 Mo |
| Audio | 20 Mo |
| Vidéos | 100 Mo |
| Données géographiques | 50 Mo |

Ces limites pourront être ajustées selon les besoins opérationnels, les performances et les coûts de stockage.

### 15.7 Compression et optimisation

Les fichiers pourront être optimisés avant stockage lorsque cela est pertinent.

- Les photographies seront compressées tout en préservant les détails nécessaires à leur exploitation.
- Les documents seront conservés dans leur format original.
- Les fichiers audio pourront être compressés avec une qualité adaptée à la compréhension vocale.
- Les vidéos pourront être optimisées pour réduire leur taille.
- Les données satellitaires et scientifiques conserveront la qualité et les caractéristiques nécessaires aux analyses.

Une attention particulière sera accordée aux images utilisées pour les diagnostics IA afin d'éviter toute perte excessive d'information.

### 15.8 Sécurité des fichiers

Le système intégrera les mécanismes suivants :

- Analyse antivirus automatique des fichiers reçus.
- Contrôle du type réel de fichier et de sa taille.
- Stockage privé par défaut.
- Accès contrôlé par les permissions métier.
- Utilisation de liens temporaires sécurisés pour les téléchargements.
- Protection contre les accès directs non autorisés.

Les fichiers privés ne devront pas être exposés par des liens publics permanents.

### 15.9 Gestion des versions

Certains documents importants bénéficieront d'un système de gestion des versions.

Chaque nouvelle version pourra conserver :
- La référence de la version précédente.
- La date de modification.
- L'utilisateur ayant effectué la modification.
- Les informations nécessaires à la traçabilité.

Cette fonctionnalité sera réservée aux catégories de documents pour lesquelles la conservation de l'historique est utile.

### 15.10 Archivage et suppression

Le système distinguera deux opérations :

**Archivage :**
- Retrait d'un fichier de l'utilisation courante.
- Conservation dans le système.
- Consultation possible par les utilisateurs autorisés.

**Suppression :**
- Retrait définitif selon les règles de conservation applicables.
- Prise en compte des obligations légales, contractuelles et des exigences de traçabilité.
- Protection particulière des documents liés aux diagnostics, aux opérations agricoles, aux dossiers financiers et aux assurances.

Les modalités exactes de conservation et de suppression seront définies dans les règles de gouvernance des données.

### 15.11 Sauvegarde et récupération

Le système devra prévoir :
- Des sauvegardes automatiques des fichiers.
- Une copie de sécurité indépendante du stockage principal.
- Des mécanismes de récupération après incident.
- Des tests réguliers de restauration.
- Une surveillance de l'intégrité des sauvegardes.

Les fichiers critiques devront pouvoir être récupérés en cas de panne ou de suppression accidentelle.

### 15.12 Téléversement en environnement à connectivité limitée

La plateforme devra prendre en charge les conditions de connectivité des zones agricoles.

Les mécanismes prévus comprennent :
- La reprise automatique des transferts interrompus.
- Le téléversement en arrière-plan lorsque cela est possible.
- L'affichage de la progression du transfert.
- La mise en attente locale des fichiers hors connexion.
- La synchronisation au retour du réseau.
- La prévention des doublons lors des nouvelles tentatives.

Ces fonctionnalités seront particulièrement importantes pour les agents terrain utilisant l'application mobile.

### 15.13 Prévisualisation des fichiers

PEST AI OS proposera une prévisualisation intégrée des formats compatibles.

Les utilisateurs pourront notamment :
- Consulter les photographies.
- Prévisualiser les documents PDF.
- Écouter les fichiers audio.
- Consulter les rapports compatibles.
- Lire les vidéos prises en charge.

La prévisualisation sera soumise aux mêmes règles de permission que le téléchargement.

### 15.14 Métadonnées des fichiers

Chaque fichier disposera de métadonnées permettant son identification et sa traçabilité.

Les informations pourront comprendre :
- Nom et format du fichier.
- Taille.
- Date et heure d'ajout.
- Utilisateur ayant envoyé le fichier.
- Organisation concernée.
- Parcelle AgroID ou dossier associé.
- Position GPS lorsqu'elle est disponible et pertinente.
- Statut de validation lorsque le contexte métier l'exige.

Les métadonnées seront enregistrées dans PostgreSQL.

### 15.15 Recherche et filtrage

Un moteur de recherche permettra de retrouver les fichiers selon plusieurs critères :
- Nom ou type de fichier.
- Parcelle AgroID.
- Producteur associé.
- Organisation ou programme.
- Date d'ajout.
- Catégorie du document.

Les résultats seront systématiquement filtrés selon les permissions de l'utilisateur.

### 15.16 Partage avec des partenaires externes

La plateforme pourra permettre le partage sécurisé de certains documents avec des acteurs externes autorisés, notamment :
- Les banques.
- Les assureurs.
- Les ONG partenaires.
- Les institutions agricoles.
- Les autres partenaires contractuels.

Le partage devra respecter :
- Les autorisations et consentements nécessaires.
- La sélection explicite des documents concernés.
- La limitation de la durée et du périmètre d'accès.
- La traçabilité des consultations et des téléchargements.

### 15.17 Suivi de la consommation du stockage

PEST AI OS intégrera un mécanisme de suivi de la consommation des ressources de stockage.

Il devra permettre :
- Le suivi de l'espace utilisé par organisation.
- L'identification des catégories de fichiers les plus volumineuses.
- La définition de quotas selon les besoins et les contrats.
- Les alertes lorsque les limites approchent.
- Le suivi des coûts globaux de stockage.

### 15.18 Séparation des fichiers classiques et des données scientifiques

L'architecture distinguera deux grandes catégories :

**Fichiers classiques :**
- Photographies.
- Documents PDF et bureautiques.
- Rapports.
- Fichiers audio et vidéo.
- Documents administratifs et agricoles.

**Données scientifiques et agricoles :**
- Images satellitaires.
- Séries temporelles NDVI et NDWI.
- Données géospatiales.
- Mesures IoT.
- Résultats d'analyses IA.
- Fichiers de mesures et d'observations agricoles.

Ces deux catégories pourront utiliser des mécanismes de stockage et de traitement adaptés à leurs caractéristiques.

### 15.19 Traitement des données volumineuses

Les données scientifiques volumineuses seront gérées par une architecture adaptée.

- Les fichiers volumineux, notamment les images satellitaires et les rasters, seront stockés dans le système de stockage objet.
- Les métadonnées et références seront conservées dans PostgreSQL.
- Les géométries et opérations spatiales seront gérées avec PostGIS.
- Les traitements lourds seront exécutés de manière asynchrone, notamment avec Celery et Redis.

Cette architecture permettra de traiter progressivement des volumes croissants de données agricoles.

### 15.20 Provenance et traçabilité des données

Chaque fichier ou donnée devra disposer d'informations permettant de retrouver son origine et son historique.

Les informations pourront inclure :
- L'auteur ou le système ayant créé la donnée.
- La date et l'heure de collecte ou de création.
- La localisation, lorsqu'elle est disponible.
- La parcelle AgroID concernée.
- L'organisation associée.
- La source : agent, producteur, satellite, capteur IoT ou modèle IA.
- Les traitements et modifications effectués.
- Les validations éventuelles.
- La version utilisée dans une analyse.

Cette traçabilité contribuera à la fiabilité des données exploitées par les agronomes, les modèles IA, les banques et les assureurs.

### 15.21 Principes techniques

L'architecture de gestion des fichiers reposera sur les principes suivants :

- Stockage objet centralisé et sécurisé.
- Séparation entre fichiers et données relationnelles.
- Gestion des métadonnées dans PostgreSQL.
- Permissions basées sur les rôles et les organisations.
- Liens d'accès temporaires et sécurisés.
- Optimisation des fichiers lorsque cela est pertinent.
- Gestion des versions et de l'archivage.
- Sauvegarde et récupération.
- Téléversement résilient en mode hors connexion.
- Recherche et prévisualisation intégrées.
- Gestion adaptée des données scientifiques volumineuses.
- Traçabilité de la provenance et des transformations.

Les choix précis des fournisseurs, des quotas, des limites de conservation et des outils de sécurité seront confirmés lors de la conception détaillée et de l'implémentation.



## 16. Architecture de recherche et d'indexation

### 16.1 Objectifs

L'architecture de recherche et d'indexation de PEST AI OS vise à permettre aux utilisateurs de retrouver rapidement les informations auxquelles ils sont autorisés à accéder.

Elle devra prendre en charge les recherches transversales dans les différents domaines métier de la plateforme, tout en respectant les permissions, les périmètres organisationnels et les règles de confidentialité.

### 16.2 Moteur de recherche global

PEST AI OS intégrera un moteur de recherche global permettant de retrouver notamment :
- Les parcelles et identifiants AgroID.
- Les producteurs.
- Les agents et agronomes.
- Les organisations et coopératives.
- Les programmes et campagnes agricoles.
- Les observations et visites terrain.
- Les diagnostics et recommandations.
- Les commandes et produits.
- Les documents et rapports.
- Les équipements et données IoT.

Les résultats seront adaptés au rôle, aux autorisations et au contexte organisationnel de l'utilisateur.

### 16.3 Recherche intelligente assistée par IA

Le moteur pourra intégrer une recherche en langage naturel afin de comprendre des demandes formulées simplement.

Exemples :
- « Trouve les parcelles de riz de cette coopérative. »
- « Affiche les producteurs ayant des parcelles dans la vallée du fleuve. »
- « Retrouve les diagnostics réalisés ce mois-ci. »
- « Montre les parcelles présentant un stress hydrique. »

L'IA pourra interpréter la demande et la convertir en critères de recherche structurés.

L'exécution de la recherche restera contrôlée par les règles d'autorisation du backend. L'IA ne pourra jamais contourner les permissions d'accès.

### 16.4 Filtres avancés et contextuels

Chaque domaine métier disposera de filtres adaptés.

Pour les parcelles, les critères pourront notamment inclure :
- Organisation et coopérative.
- Région, département et commune.
- Culture.
- Superficie.
- Statut AgroID.
- Campagne agricole.
- Programme agricole.
- Niveau de risque.
- État de surveillance.

Les autres domaines disposeront de filtres spécifiques selon leurs caractéristiques.

### 16.5 Recherche géographique

Le moteur sera intégré à l'architecture géospatiale de PEST AI OS, notamment PostGIS et MapLibre.

Il permettra :
- La recherche de parcelles par région, commune ou zone géographique.
- La recherche autour d'un point géographique.
- La recherche dans une zone dessinée sur la carte.
- L'identification de parcelles présentant des anomalies satellitaires dans une zone donnée.
- Le filtrage géographique par culture et organisation.

Les résultats pourront être affichés sous forme de liste et sur la carte.

### 16.6 Historique et suggestions

Le moteur pourra proposer :
- Un historique personnel des recherches récentes.
- Des suggestions pendant la saisie.
- Des raccourcis vers les recherches fréquentes.
- Des suggestions de producteurs, parcelles, organisations et cultures.

L'historique sera propre à chaque utilisateur et les suggestions respecteront les permissions applicables.

### 16.7 Recherche multilingue et tolérance aux erreurs

Le moteur devra progressivement prendre en charge :
- La recherche en français.
- La recherche en Wolof.
- La recherche en Pulaar.
- La tolérance aux fautes de frappe.
- La reconnaissance des termes proches.
- La recherche sans distinction d'accents lorsque cela est pertinent.

L'intégration de Fary ASR permettra également de proposer une recherche vocale.

Les capacités linguistiques seront évaluées et améliorées progressivement selon la qualité réelle des modèles disponibles.

### 16.8 Sécurité et confidentialité des résultats

Toutes les recherches devront respecter les règles d'isolation des organisations.

Les principes suivants s'appliqueront :
- Le producteur accède uniquement à ses informations et aux données qui lui sont autorisées.
- L'agent terrain accède aux données relevant de ses missions et affectations.
- L'agronome accède aux organisations et programmes pour lesquels il dispose d'une autorisation.
- Une coopérative ne peut pas consulter les données privées d'une autre coopérative.
- Une ONG accède aux données de ses programmes et bénéficiaires autorisés.
- PEST AI conserve les responsabilités globales de superadministration dans un cadre sécurisé et audité.

Les contrôles d'accès seront exécutés côté backend, y compris lors des recherches avancées et des requêtes générées à partir du langage naturel.

### 16.9 Export des résultats

Les utilisateurs autorisés pourront exporter les résultats de recherche dans plusieurs formats :

- XLSX : listes et données structurées.
- CSV : exploitation dans des outils externes.
- PDF : rapports et synthèses.
- GeoJSON et KML : données géographiques.

Les exports respecteront les filtres appliqués, les permissions et les règles de confidentialité.

Les exports volumineux seront générés de manière asynchrone et leur téléchargement sera sécurisé.

### 16.10 Recherche dans le contenu des documents

Le moteur pourra rechercher des informations à l'intérieur des documents, et pas uniquement dans leurs noms ou métadonnées.

Les fonctionnalités envisagées comprennent :
- L'indexation du texte des PDF.
- La recherche dans les rapports et documents bureautiques compatibles.
- La recherche de références AgroID.
- La recherche de noms de producteurs et d'organisations.
- L'utilisation de l'OCR pour extraire le texte des PDF scannés et des images contenant du texte.

L'indexation devra respecter les permissions des documents d'origine.

### 16.11 Recherche prédictive et personnalisée

Le moteur pourra proposer des recherches et raccourcis en fonction de l'activité de l'utilisateur.

Exemples :
- Les missions récentes pour un agent terrain.
- Les diagnostics consultés pour un agronome.
- Les parcelles suivies pendant une campagne pour un responsable.
- Les producteurs et commandes fréquemment consultés pour une coopérative.

Cette personnalisation devra respecter la confidentialité des historiques et ne pas exposer les activités privées d'un utilisateur à d'autres utilisateurs.

### 16.12 Performance et évolutivité

L'architecture devra permettre de gérer progressivement des volumes importants de données.

Les principes retenus sont :
- Indexation automatique des données pertinentes.
- Mise à jour des index après création, modification ou suppression.
- Recherche paginée.
- Optimisation des requêtes.
- Mise en cache lorsque cela est pertinent.
- Surveillance des performances et des temps de réponse.

La première version pourra s'appuyer sur les capacités d'indexation et de recherche de PostgreSQL.

Un moteur spécialisé comme Elasticsearch ou OpenSearch pourra être intégré ultérieurement si les volumes, les fonctionnalités ou les performances le justifient.

### 16.13 Traçabilité des recherches sensibles et des exports

Les opérations sensibles devront être historisées.

Les informations pourront inclure :
- L'utilisateur ayant effectué l'opération.
- La date et l'heure.
- Le type de données consultées ou exportées.
- Le périmètre organisationnel concerné.
- Le type et le format de l'export.
- Les consultations et téléchargements de rapports sensibles.

Cette traçabilité renforcera la gouvernance des données, notamment pour les échanges avec les banques, assureurs et partenaires.

### 16.14 Principes techniques

L'architecture de recherche reposera sur les principes suivants :

- Recherche globale centralisée.
- Indexation des données métier.
- Recherche contextuelle par domaine.
- Recherche géographique avec PostGIS.
- Recherche intelligente assistée par IA.
- Recherche vocale avec Fary ASR.
- Recherche documentaire avec OCR.
- Filtrage systématique selon les permissions.
- Export sécurisé des résultats.
- Architecture progressive et évolutive.
- Traçabilité des opérations sensibles.

Les technologies et mécanismes spécialisés seront sélectionnés et dimensionnés lors de la conception détaillée et de l'implémentation.


## 17. Architecture de reporting, tableaux de bord et indicateurs

### 17.1. Objectif

PEST AI OS intègre un système centralisé de reporting permettant de transformer les données agricoles, opérationnelles, géospatiales, techniques et financières en informations utiles à la prise de décision.

Les tableaux de bord sont adaptés aux rôles des utilisateurs et aux organisations auxquelles ils appartiennent.

### 17.2. Tableaux de bord personnalisés

Chaque catégorie d'utilisateur dispose d'un tableau de bord adapté à ses responsabilités.

Exemples :

- **Producteur :** évolution des parcelles, cultures, activités, rendements, alertes et recommandations.
- **Agent terrain :** missions, visites, parcelles suivies, observations et synchronisations.
- **Agronome :** diagnostics, validations, recommandations et suivis techniques.
- **Coopérative :** producteurs, superficies, cultures, campagnes, rendements et commandes.
- **ONG et programmes :** bénéficiaires, parcelles, objectifs, réalisations et résultats.
- **Fournisseur :** produits, commandes, ventes et activité commerciale.
- **PEST AI :** vision globale de la plateforme, organisations, couverture géographique, activité et performances.
- **Partenaires financiers :** indicateurs agricoles et SFA autorisés, dans le cadre des accès accordés.

### 17.3. Actualisation des indicateurs

Les indicateurs sont actualisés automatiquement selon la disponibilité et la fréquence de traitement des données.

Exemples :

- Nombre de parcelles enregistrées.
- Superficies agricoles digitalisées.
- Nombre de producteurs suivis.
- Missions terrain en cours.
- Diagnostics en attente de validation.
- Commandes en cours.
- Alertes agricoles actives.

Le système distingue les données disponibles immédiatement, celles nécessitant une synchronisation et celles nécessitant un traitement différé.

### 17.4. Comparaison des performances

Les tableaux de bord permettent de comparer les résultats dans le temps et entre plusieurs périmètres autorisés.

Exemples :

- Comparaison des rendements entre campagnes agricoles.
- Évolution des superficies cultivées entre saisons.
- Progression du nombre de producteurs accompagnés.
- Comparaison des performances entre coopératives.
- Évaluation des résultats d'un programme par rapport à ses objectifs.

Les comparaisons doivent tenir compte de la qualité, de la période et de la comparabilité des données.

### 17.5. Modes de visualisation

Le système propose plusieurs formats de visualisation :

- **Graphiques :** évolution des rendements, superficies, producteurs et performances.
- **Cartes géographiques :** répartition des parcelles, cultures et zones agricoles.
- **Tableaux détaillés :** consultation et comparaison des données.
- **Indicateurs visuels :** progression des objectifs, performances et alertes.

Les visualisations géographiques s'appuient sur les données spatiales disponibles dans PostGIS et leur affichage cartographique avec MapLibre.

### 17.6. Navigation interactive

Les indicateurs et visualisations permettent d'accéder directement aux informations détaillées.

Exemples :

- Sélectionner le nombre de producteurs pour consulter leur liste.
- Sélectionner une parcelle pour ouvrir sa fiche AgroID.
- Sélectionner les diagnostics en attente pour consulter les dossiers concernés.
- Sélectionner une commande pour consulter son état.
- Sélectionner une zone cartographique pour afficher les parcelles correspondantes.

Chaque navigation respecte les règles de permissions et d'isolation des organisations.

### 17.7. Personnalisation des tableaux de bord

Deux niveaux de personnalisation sont prévus :

**Tableau de bord par organisation :**
- L'administrateur définit une configuration par défaut.
- Il choisit les indicateurs utiles à son organisation.
- Il peut adapter cette configuration aux responsabilités de ses membres.

**Tableau de bord personnel :**
- Chaque utilisateur peut choisir les indicateurs qu'il souhaite afficher.
- Il peut modifier leur ordre et leur disposition.
- Il peut masquer les éléments qui ne lui sont pas utiles.
- Sa configuration personnelle est conservée.

La personnalisation de l'interface ne modifie jamais les permissions d'accès aux données.

### 17.8. Génération automatique des rapports

PEST AI OS permet de générer des rapports périodiques :

- **Quotidiens :** activités terrain, alertes et événements importants.
- **Hebdomadaires :** évolution des parcelles, missions et observations.
- **Mensuels :** rendements, producteurs suivis, performances et progression des programmes.
- **Fin de campagne :** bilan agricole, superficies, productions, rendements et résultats.

Les rapports sont consultables sur la plateforme et exportables en PDF ou Excel.

La génération des rapports volumineux est exécutée de manière asynchrone avec Celery et Redis.

### 17.9. Distribution des rapports

Chaque organisation peut définir les destinataires de ses rapports.

Exemples :

- Les responsables de coopératives reçoivent les bilans de leurs producteurs et parcelles.
- Les responsables de programmes reçoivent le suivi des bénéficiaires et des objectifs.
- Les agronomes reçoivent les rapports techniques et les diagnostics.
- L'équipe PEST AI dispose de rapports globaux selon ses autorisations.

Les administrateurs peuvent configurer les destinataires et la fréquence d'envoi.

La distribution respecte strictement les permissions et les périmètres organisationnels.

### 17.10. Alertes sur les indicateurs

Le système peut détecter des écarts significatifs par rapport aux objectifs ou aux seuils définis.

Exemples :

- Objectifs de superficie non atteints.
- Baisse inhabituelle du rendement d'une culture.
- Augmentation des parcelles en attente de validation.
- Retard dans l'exécution d'un programme.
- Accumulation de missions terrain en retard.

Les alertes sont affichées dans les tableaux de bord et transmises aux responsables concernés selon les règles de notification.

Les seuils et règles d'alerte doivent être configurables et adaptés au contexte de chaque organisation.

### 17.11. Qualité et fraîcheur des données

Les tableaux de bord doivent afficher les informations permettant d'évaluer la fiabilité des indicateurs.

Le système distingue notamment :

- Données déclarées.
- Données collectées sur le terrain.
- Données vérifiées.
- Données validées.
- Données estimées.
- Données incomplètes ou anciennes.

Il affiche également la date de dernière actualisation ou synchronisation lorsque cela est pertinent.

Les indicateurs calculés à partir de données incomplètes doivent être clairement signalés afin d'éviter les interprétations erronées.

### 17.12. Tableaux de bord mobiles et consultation hors connexion

Les tableaux de bord sont accessibles depuis l'application mobile React Native, avec une interface adaptée aux petits écrans et aux appareils disposant de ressources limitées.

Les informations présentées sont adaptées à chaque rôle.

Une partie des indicateurs peut être consultée hors connexion à partir des dernières données synchronisées.

Le système affiche la date de dernière actualisation afin de distinguer les informations récentes des données potentiellement anciennes.

La consultation hors ligne respecte les règles de sécurité et de protection des données définies dans l'architecture mobile.

### 17.13. Indicateurs financiers

PEST AI OS intègre des indicateurs de pilotage financier adaptés aux organisations autorisées.

Exemples :

- **Coopératives :** coûts de production, dépenses agricoles et revenus déclarés.
- **ONG et programmes :** budgets alloués, dépenses engagées et suivi des financements.
- **Fournisseurs :** commandes, ventes et chiffre d'affaires.
- **PEST AI :** revenus de la plateforme, abonnements et performances commerciales.
- **Banques et assureurs :** indicateurs agricoles et SFA autorisés pour l'évaluation des dossiers.

Ces fonctionnalités constituent un système de suivi et d'aide à la décision financière agricole. Elles ne remplacent pas un logiciel de comptabilité.

### 17.14. Architecture technique

Le système de reporting s'appuie sur les composants suivants :

- **Backend Django :** collecte, calcul et exposition des indicateurs.
- **Django REST Framework :** API de consultation des tableaux de bord et rapports.
- **PostgreSQL :** stockage des données et des résultats nécessaires au reporting.
- **PostGIS :** analyses et indicateurs géospatiaux.
- **Celery + Redis :** calculs différés, génération de rapports et traitements périodiques.
- **React + TypeScript :** tableaux de bord web et visualisations.
- **React Native + Expo :** tableaux de bord mobiles et consultation hors connexion.
- **Cloudflare R2 ou stockage compatible S3 :** conservation des rapports générés et fichiers exportés.

Des mécanismes de cache, d'indexation et d'agrégation pourront être utilisés pour améliorer les performances lorsque les volumes de données augmenteront.

### 17.15. Sécurité et contrôle des accès

Tous les indicateurs et rapports sont soumis aux règles générales de sécurité de PEST AI OS.

Les principes suivants sont obligatoires :

- Respect strict de l'isolation des organisations.
- Vérification des permissions côté backend.
- Limitation des données visibles selon le rôle et le périmètre autorisé.
- Protection des rapports exportés.
- Contrôle des destinataires avant toute distribution.
- Traçabilité des générations, consultations et téléchargements sensibles.

Aucun tableau de bord, rapport ou export ne doit permettre de contourner les autorisations d'accès.

### 17.16. Principes d'évolution

Le système de reporting doit rester modulaire et extensible.

Il pourra évoluer vers :

- Des indicateurs prédictifs fondés sur les modèles d'intelligence artificielle.
- Des analyses comparatives entre zones agroécologiques.
- Des rapports personnalisés pour les institutions et partenaires.
- Des analyses avancées de performance agricole.
- Des tableaux de bord consolidés à l'échelle nationale ou régionale, selon les autorisations et la disponibilité des données.

L'objectif est de faire du reporting un véritable outil de pilotage de l'intelligence agricole, opérationnelle et financière de PEST AI OS.



## 18. Architecture de traçabilité et d'audit

### 18.1. Objectif

PEST AI OS intègre un système centralisé de traçabilité et d'audit permettant d'enregistrer, de consulter et de contrôler les actions importantes réalisées sur la plateforme.

Ce système garantit la transparence, la responsabilité des utilisateurs, l'intégrité des données et la possibilité de reconstituer l'historique des opérations.

Il constitue un élément essentiel de confiance pour les producteurs, les coopératives, les ONG, les institutions, les banques, les assureurs et les partenaires de PEST AI.

### 18.2. Journal centralisé des événements

Un journal centralisé conserve les événements importants de la plateforme.

Les événements concernés comprennent notamment :

- Création et modification des parcelles AgroID.
- Modification des informations des producteurs.
- Création et validation des observations.
- Création, correction et validation des diagnostics.
- Création et modification des recommandations agronomiques.
- Gestion des missions et visites terrain.
- Modifications des comptes et des permissions.
- Consultation, partage et exportation de dossiers sensibles.
- Gestion des commandes et opérations commerciales.
- Actions des administrateurs et superadministrateurs.
- Synchronisation des données collectées hors connexion.

Chaque événement est associé à son contexte et à son origine.

### 18.3. Historique détaillé des modifications

Les modifications importantes conservent un historique permettant de retrouver :

- L'ancienne valeur.
- La nouvelle valeur.
- L'utilisateur responsable.
- La date et l'heure de la modification.
- L'organisation concernée.
- L'entité ou le dossier concerné.
- Le motif de la modification, lorsque nécessaire.

Exemple : lorsqu'un agent terrain corrige la superficie d'une parcelle AgroID, le système conserve l'ancienne superficie, la nouvelle et l'identité de l'agent ayant effectué la correction.

Les données historiques doivent rester consultables selon les permissions applicables.

### 18.4. Protection du journal d'audit

Les événements sensibles sont enregistrés dans un journal protégé contre les modifications et suppressions ordinaires.

Cela concerne notamment :

- Validation ou rejet d'un diagnostic.
- Modification des droits d'accès.
- Partage d'un dossier avec une banque ou un assureur.
- Exportation de données sensibles.
- Suppression ou archivage d'une parcelle.
- Interventions du superadministrateur PEST AI.

Le journal doit intégrer des mécanismes techniques renforçant son intégrité, notamment des accès restreints, une conservation protégée et des mécanismes de détection d'altération.

Même un administrateur ne doit pas pouvoir effacer discrètement les traces d'une action sensible.

Les éventuelles opérations de purge réglementaire ou de conservation exceptionnelle doivent suivre une procédure contrôlée et traçable.

### 18.5. Gestion des accès aux journaux

Trois niveaux principaux d'accès sont prévus :

**Administrateur d'organisation :**
- Consultation des événements de sa propre organisation.
- Suivi des actions des membres autorisés.
- Consultation des modifications concernant son périmètre.

**Responsable habilité :**
- Consultation des événements liés à ses responsabilités.
- Accès limité aux informations nécessaires à ses missions.

**Superadministrateur PEST AI :**
- Vision globale des événements de la plateforme selon ses autorisations.
- Suivi des événements interorganisations.
- Traçabilité de ses propres consultations et interventions.

Les utilisateurs ordinaires ne disposent pas d'un accès direct aux journaux internes d'audit.

Toute consultation sensible des journaux est elle-même enregistrée.

### 18.6. Détection des activités inhabituelles

Le système peut détecter des comportements inhabituels et générer des alertes de sécurité.

Exemples :

- Tentatives répétées de connexion échouées.
- Connexion depuis un nouvel appareil ou une localisation inhabituelle.
- Modification inhabituelle des permissions.
- Tentatives d'accès aux données d'une autre organisation.
- Exportation massive de données.
- Multiplication d'actions sensibles par un même compte sur une courte période.

Chaque événement peut être associé à un niveau de risque.

Les alertes sont transmises aux responsables habilités selon les règles de sécurité définies.

Les détections automatiques constituent des signaux à examiner et ne doivent pas être considérées systématiquement comme des preuves de compromission.

### 18.7. Conservation des journaux

PEST AI OS applique une politique de conservation différenciée selon la nature et la sensibilité des événements.

Exemples :

- Connexions et sessions : conservation selon les besoins de sécurité.
- Modifications des données agricoles : conservation de l'historique nécessaire à leur traçabilité.
- Diagnostics et validations agronomiques : conservation de l'historique des décisions.
- Accès aux données financières : conservation renforcée.
- Actions des administrateurs : conservation renforcée.

Les durées exactes seront définies selon les obligations légales, réglementaires et contractuelles applicables.

Le système prévoit des mécanismes d'archivage et de suppression sécurisée lorsque la conservation n'est plus nécessaire.

### 18.8. Traçabilité des décisions de l'intelligence artificielle

Chaque résultat important produit par les modèles d'IA doit être traçable.

Les informations conservées comprennent :

- Le modèle d'IA utilisé.
- La version du modèle.
- Les données d'entrée ou leurs références.
- La date et l'heure de l'analyse.
- Le résultat généré.
- Le niveau de confiance lorsqu'il est disponible et correctement calibré.
- Les éventuelles corrections apportées par un agronome.
- La décision finale et son responsable.

Le système conserve séparément le résultat initial de l'IA et les éventuelles corrections humaines.

Un agronome peut confirmer, corriger ou rejeter un résultat généré par l'IA. Il peut également créer un diagnostic directement sans utiliser l'IA.

L'ensemble de ces décisions reste historisé.

### 18.9. Recherche et filtrage des journaux

Les utilisateurs habilités disposent d'une fonctionnalité de recherche et de filtrage des événements.

Les critères comprennent :

- Utilisateur responsable.
- Organisation concernée.
- Type d'action.
- Parcelle AgroID ou dossier concerné.
- Période de début et de fin.
- Niveau de risque ou de sensibilité.

Exemple : un administrateur de coopérative peut retrouver les modifications effectuées sur une parcelle pendant les trois derniers mois.

La recherche respecte systématiquement les permissions et les périmètres organisationnels.

### 18.10. Exportation des journaux d'audit

Les utilisateurs autorisés peuvent exporter certains journaux pour :

- Les audits internes.
- Les contrôles de conformité.
- Les vérifications institutionnelles.
- Les investigations après un incident de sécurité.

Les formats prévus sont PDF et Excel.

Chaque exportation doit être contrôlée, protégée et enregistrée dans le journal d'audit.

Les exports ne doivent jamais contenir d'événements situés hors du périmètre d'autorisation du demandeur.

### 18.11. Traçabilité des échanges avec les partenaires externes

Chaque échange de données avec un partenaire externe doit être enregistré.

Cela concerne notamment :

- Banques.
- Assureurs.
- Fournisseurs.
- Services satellitaires.
- Services météorologiques.
- Services d'intelligence artificielle.
- Autres partenaires institutionnels et techniques.

Les informations conservées comprennent :

- Le partenaire concerné.
- La nature des données transmises ou reçues.
- L'organisation ou le producteur concerné.
- La date et l'heure de l'échange.
- L'autorisation ou le consentement justifiant l'échange, lorsque requis.
- Le statut de l'opération : réussie, échouée ou en attente.

### 18.12. Gestion des consentements et autorisations

PEST AI OS conserve l'historique des consentements accordés par les producteurs et les organisations.

Exemples :

- Autorisation de partage d'un dossier agricole avec une banque.
- Autorisation de partage de données dans le cadre d'un programme.
- Autorisation de partage avec un assureur.
- Autorisation d'utilisation de certaines données pour des finalités définies.

Le système conserve :

- L'identité de la personne ou de l'organisation ayant donné son accord.
- L'objet du consentement.
- Les données concernées.
- Le destinataire autorisé.
- La date et l'heure.
- La version des conditions acceptées.
- Les modifications ou révocations éventuelles.

Le retrait d'une autorisation est pris en compte selon les obligations légales et contractuelles applicables.

### 18.13. Protection des informations contenues dans les journaux

Les journaux doivent respecter un principe de minimisation des données.

Les règles suivantes sont obligatoires :

- Ne jamais enregistrer les mots de passe.
- Ne jamais enregistrer les jetons d'authentification.
- Éviter de recopier intégralement les dossiers agricoles ou financiers.
- Utiliser les références des entités concernées plutôt que leurs contenus complets lorsque cela suffit.
- Masquer les informations sensibles dans les détails techniques.
- Restreindre les accès aux journaux selon les responsabilités.

L'objectif est de garantir la traçabilité sans transformer les journaux en source supplémentaire de fuite de données.

### 18.14. Traçabilité des opérations hors connexion

Les opérations effectuées hors connexion doivent conserver leur historique.

Les informations suivantes sont notamment enregistrées :

- Date et heure de réalisation sur le téléphone.
- Date et heure de réception sur le serveur.
- Identité de l'utilisateur responsable.
- Référence de l'appareil utilisé.
- Références des données transmises.
- Statut de synchronisation.
- Éventuelles corrections ou résolutions de conflits.

Le système distingue l'heure réelle de réalisation de l'opération et l'heure de réception par le serveur.

Cette distinction permet de reconstituer correctement l'historique des activités terrain, même lorsque la synchronisation intervient plusieurs heures ou jours après la collecte.

### 18.15. Architecture technique

Le système de traçabilité s'appuie sur les composants suivants :

- **Django :** gestion des événements, règles métier et contrôle des accès.
- **Django REST Framework :** API sécurisées de consultation des journaux.
- **PostgreSQL :** stockage des événements, historiques et métadonnées d'audit.
- **Celery + Redis :** traitement asynchrone des événements, alertes et tâches de conservation.
- **Stockage objet sécurisé :** archivage des exports et archives d'audit lorsque nécessaire.

Les événements critiques doivent être enregistrés de manière fiable. Leur conservation ne doit pas dépendre uniquement d'une tâche asynchrone susceptible d'échouer silencieusement.

Des mécanismes d'intégrité, de sauvegarde, de contrôle d'accès et de surveillance doivent protéger les journaux.

### 18.16. Principes d'évolution

L'architecture doit permettre d'intégrer progressivement :

- Des mécanismes avancés de détection des anomalies.
- Des outils de surveillance de sécurité.
- Des audits automatisés.
- Des rapports de conformité.
- Des mécanismes renforcés de preuve d'intégrité.
- Des interfaces d'audit adaptées aux partenaires institutionnels.

L'objectif est de faire de la traçabilité un mécanisme transversal garantissant la confiance, la transparence et la responsabilité dans l'ensemble de PEST AI OS.



## 19. Architecture de performance et de scalabilité

### 19.1. Objectif

PEST AI OS doit disposer d'une architecture capable de supporter une croissance progressive du nombre d'utilisateurs, d'organisations, de parcelles, de données agricoles et de traitements d'intelligence artificielle.

L'objectif est de commencer avec des ressources maîtrisées, puis d'augmenter progressivement les capacités techniques sans devoir reconstruire l'ensemble de la plateforme.

L'architecture doit également garantir de bonnes performances dans les zones agricoles où les connexions Internet sont parfois faibles et les équipements mobiles limités.

### 19.2. Gestion des pics de charge

La plateforme doit pouvoir gérer les périodes de forte activité.

Exemples :

- Synchronisation simultanée des données par plusieurs centaines d'agents terrain.
- Envoi massif de photos destinées aux diagnostics IA.
- Consultation simultanée des tableaux de bord par plusieurs coopératives.
- Traitements satellitaires multiples.
- Génération simultanée de rapports en fin de campagne.

Les mécanismes prévus comprennent :

- Files d'attente avec Celery et Redis.
- Mise en cache des données fréquemment consultées.
- Optimisation des connexions à PostgreSQL.
- Traitements asynchrones.
- Répartition des tâches entre plusieurs workers.

### 19.3. Optimisation des performances

Les opérations les plus coûteuses doivent être optimisées.

Principes retenus :

- Chargement progressif des parcelles et des données cartographiques.
- Compression des images avant transmission, sans dégrader celles destinées aux diagnostics IA.
- Réduction des calculs répétitifs.
- Optimisation des requêtes PostgreSQL et PostGIS.
- Mise en cache des informations fréquemment consultées.
- Exécution des analyses IA et des rapports volumineux en arrière-plan.
- Pagination des listes et résultats volumineux.
- Optimisation des transferts de données mobiles.

L'application doit rester utilisable sur les téléphones Android d'entrée de gamme.

### 19.4. Montée en capacité de l'infrastructure

L'infrastructure doit permettre deux formes de montée en capacité :

**Scaling vertical :**
- Augmentation de la mémoire.
- Augmentation de la puissance CPU.
- Augmentation des ressources de stockage.
- Renforcement des capacités des services existants.

**Scaling horizontal :**
- Ajout de plusieurs instances backend.
- Ajout de workers Celery.
- Répartition de la charge entre plusieurs instances.
- Séparation progressive des traitements nécessitant davantage de ressources.

La montée en capacité doit être progressive, contrôlée et adaptée au budget de PEST AI.

### 19.5. Objectifs de performance mesurables

PEST AI OS doit disposer d'objectifs techniques mesurables.

Les principaux indicateurs comprennent :

- Temps de réponse des API.
- Temps de chargement des pages principales.
- Temps d'affichage des cartes.
- Durée des synchronisations.
- Temps de traitement des analyses IA.
- Disponibilité des services.
- Capacité de traitement simultané.
- Taux d'erreurs.

Les seuils précis seront définis lors des phases de dimensionnement, de tests et de validation technique.

Les traitements longs doivent afficher leur état : en attente, en cours, terminé ou échoué.

### 19.6. Gestion des volumes de données

L'architecture doit séparer les catégories de données selon leur nature et leurs besoins de stockage.

**Données opérationnelles :**
- Stockage dans PostgreSQL.

**Données géographiques :**
- Stockage et traitement dans PostgreSQL avec PostGIS.

**Photos et documents :**
- Stockage objet avec Cloudflare R2 ou un service compatible S3.

**Données satellitaires volumineuses :**
- Stockage objet adapté aux données scientifiques et géospatiales.

**Historiques et archives :**
- Conservation organisée selon leur fréquence d'utilisation, leur importance et les règles de rétention.

Cette séparation permet de maîtriser les coûts et d'éviter que la croissance des fichiers volumineux ralentisse la base de données opérationnelle.

### 19.7. Disponibilité et résilience

La plateforme doit être conçue pour limiter les conséquences des pannes partielles.

Principes retenus :

- Une panne d'un service IA ne doit pas arrêter les autres fonctionnalités.
- Une panne du service de notifications ne doit pas rendre les données agricoles inaccessibles.
- Une interruption Internet ne doit pas entraîner la perte des données collectées localement.
- Une indisponibilité d'un service externe ne doit pas bloquer toute la plateforme.
- Les opérations interrompues doivent pouvoir être reprises sans perte ni duplication de données.

Les composants critiques devront disposer de mécanismes de surveillance et de reprise adaptés.

### 19.8. Gestion des ressources et des quotas

La plateforme doit permettre de contrôler la consommation des ressources par organisation et par service.

Exemples :

- Quotas de stockage par organisation.
- Limites adaptées aux analyses IA.
- Contrôle des envois de fichiers volumineux.
- Planification des traitements satellitaires.
- Limitation des opérations excessives.
- Suivi de la consommation des services externes.

Les quotas doivent être configurables selon les contrats, les besoins et les capacités de chaque organisation.

Ils ne doivent pas empêcher les opérations critiques nécessaires à la sécurité ou à l'intégrité des données.

### 19.9. Surveillance des performances

Les performances doivent être surveillées automatiquement.

Les indicateurs techniques suivis comprennent :

- Temps de réponse des API.
- Charge CPU et mémoire du backend.
- Utilisation de PostgreSQL.
- Nombre de traitements en attente.
- Temps de synchronisation mobile.
- Taux d'erreurs.
- Consommation du stockage.
- Ressources des workers Celery.
- Disponibilité des services.

Les ralentissements et consommations anormales doivent générer des alertes destinées à l'équipe technique.

### 19.10. Tests de charge et de capacité

Des tests de charge réguliers doivent être réalisés pour évaluer la capacité de la plateforme.

Scénarios initiaux à étudier :

- 100 utilisateurs connectés simultanément.
- 500 agents synchronisant leurs données.
- 1 000 requêtes API sur une période courte.
- Plusieurs centaines de photos envoyées pour analyse.
- Plusieurs rapports générés simultanément.

Ces valeurs constituent des scénarios de test et non des capacités garanties.

Les résultats permettront de déterminer les limites réelles de l'infrastructure et les optimisations nécessaires.

### 19.11. Tests en conditions réelles

Les tests doivent également être effectués dans les conditions d'utilisation réelles au Sénégal et dans les zones agricoles ciblées.

Les scénarios comprennent :

- Téléphones Android d'entrée de gamme.
- Connexions 2G, 3G et 4G instables.
- Interruptions fréquentes d'Internet.
- Synchronisations après plusieurs heures ou jours hors connexion.
- Consultation de cartes avec un débit limité.
- Transferts de photos et documents sur des réseaux faibles.

L'objectif est de garantir une expérience utilisable malgré les contraintes matérielles et réseau.

### 19.12. Priorisation des traitements

Les traitements sont répartis en quatre niveaux de priorité :

**Priorité critique :**
- Alertes agricoles critiques.
- Opérations de sécurité.
- Synchronisations urgentes nécessaires à l'intégrité des données.

**Priorité élevée :**
- Diagnostics IA.
- Traitements nécessaires aux activités terrain.

**Priorité normale :**
- Actualisation des tableaux de bord.
- Traitements opérationnels courants.

**Priorité basse :**
- Rapports périodiques.
- Analyses historiques.
- Exports volumineux.

Les files d'attente Celery et Redis permettent d'organiser et de distribuer ces traitements selon leur priorité.

### 19.13. Reprise automatique des traitements échoués

Les traitements temporairement échoués doivent pouvoir être relancés automatiquement.

Le mécanisme prévoit :

- Plusieurs tentatives de traitement.
- Des délais progressifs entre les tentatives.
- La prévention des doublons grâce à des mécanismes d'idempotence.
- L'enregistrement des erreurs.
- La mise à l'écart des tâches ayant définitivement échoué.
- La possibilité de reprise manuelle par les personnes habilitées.

Les traitements qui échouent de manière répétée doivent générer des alertes techniques.

### 19.14. Isolation des traitements

Les différents types de traitements doivent pouvoir fonctionner dans des files d'attente et des ressources séparées lorsque cela est nécessaire.

Exemples :

- Les analyses IA ne doivent pas bloquer les synchronisations terrain.
- Les traitements satellitaires ne doivent pas ralentir les API utilisées par les producteurs.
- La génération de rapports ne doit pas perturber les opérations des coopératives.
- Les tâches urgentes doivent conserver leur priorité.

Cette organisation permettra de faire évoluer indépendamment les capacités des différents services.

### 19.15. Architecture technique de référence

Les composants retenus pour assurer la performance et la scalabilité sont :

- **React + TypeScript :** interface web optimisée.
- **React Native + Expo :** application mobile adaptée aux appareils modestes.
- **Django + Django REST Framework :** backend et API.
- **PostgreSQL + PostGIS :** données opérationnelles et géographiques.
- **Celery + Redis :** traitements asynchrones et files d'attente.
- **Cloudflare R2 ou stockage compatible S3 :** stockage évolutif des fichiers.
- **Cache applicatif :** réduction des calculs et requêtes répétitives.
- **Services de monitoring :** surveillance des performances et de la disponibilité.

### 19.16. Principes d'évolution

L'architecture doit permettre :

- L'augmentation progressive du nombre d'organisations.
- L'extension de la couverture géographique.
- L'augmentation du nombre de parcelles AgroID.
- L'intégration de nouveaux modèles d'intelligence artificielle.
- L'augmentation des volumes de données satellitaires et IoT.
- La séparation éventuelle de certains modules en services indépendants lorsque les besoins le justifient.

Le principe retenu est de conserver une architecture modulaire et maîtrisée, en évitant une complexité technique prématurée.

L'objectif est de faire évoluer PEST AI OS en fonction de son utilisation réelle, de ses besoins métier et de ses capacités financières.


## 20. Architecture des tests et assurance qualité

### 20.1. Objectif

L'objectif de cette architecture est de garantir la fiabilité, la sécurité, la stabilité et la qualité de PEST AI OS tout au long de son développement et de son exploitation.

Chaque nouvelle fonctionnalité doit être vérifiée avant sa mise à disposition des utilisateurs.

Les tests doivent couvrir les composants techniques, les règles métier, les interactions entre modules et les parcours réels des utilisateurs.

### 20.2. Niveaux de tests

PEST AI OS adoptera trois niveaux complémentaires de tests.

**1. Tests unitaires**

Ils vérifient chaque composant indépendamment :

- Fonctions et méthodes.
- Calculs et règles métier.
- Validations des données.
- Permissions et autorisations.
- Traitements individuels.

**2. Tests d'intégration**

Ils vérifient le bon fonctionnement des composants lorsqu'ils communiquent entre eux :

- Backend et base de données.
- API et application mobile.
- API et services externes.
- Celery et Redis.
- Services IA et stockage des fichiers.
- Mécanismes de synchronisation.

**3. Tests de bout en bout (E2E)**

Ils reproduisent les parcours réels des utilisateurs.

Exemple : un agent crée une parcelle AgroID, renseigne les informations agricoles, ajoute une observation et synchronise les données avec le backend.

### 20.3. Tests spécifiques aux fonctionnalités critiques

Des scénarios de tests dédiés seront prévus pour les modules sensibles.

**Sécurité et multi-organisations :**
- Vérification de l'isolation des organisations.
- Contrôle des rôles et permissions.
- Prévention des accès non autorisés.

**AgroID et géospatial :**
- Création et modification des parcelles.
- Validation des géométries.
- Calcul des surfaces.
- Vérification des coordonnées et des chevauchements.

**Synchronisation mobile :**
- Synchronisation hors ligne et en ligne.
- Gestion des conflits.
- Prévention des doublons.
- Reprise après interruption réseau.

**Intelligence artificielle :**
- Vérification des entrées et sorties.
- Gestion des erreurs de traitement.
- Traçabilité des modèles et versions.
- Vérification des résultats et de leur validation humaine.

**Finance et SFA :**
- Vérification des calculs.
- Cohérence des historiques.
- Gestion des autorisations de partage.
- Contrôle des accès aux dossiers.

**Commandes et fournisseurs :**
- Création des commandes individuelles.
- Commandes groupées des coopératives.
- Suivi des statuts.
- Répartition des commandes par bénéficiaire.

### 20.4. Automatisation des tests avec GitHub Actions

PEST AI OS utilisera GitHub Actions pour automatiser les contrôles de qualité du code.

À chaque modification du code ou proposition d'intégration, les contrôles configurés pourront notamment :

- Exécuter les tests unitaires.
- Exécuter les tests d'intégration.
- Vérifier la qualité et la cohérence du code.
- Détecter certaines erreurs.
- Vérifier les fonctionnalités existantes.
- Produire un rapport de résultats.

Les contrôles obligatoires devront réussir avant l'intégration des modifications concernées dans les branches protégées.

### 20.5. Validation manuelle avant mise en production

Les tests automatiques ne remplacent pas les vérifications humaines.

Avant chaque mise en production, une validation sur Staging devra être réalisée.

Elle pourra impliquer :

- Un agent terrain pour vérifier les parcours de collecte.
- Un agronome pour vérifier les diagnostics et recommandations.
- Un administrateur pour vérifier les accès et les données de son organisation.
- L'équipe technique pour vérifier les performances, les erreurs et le fonctionnement général.

Les contrôles obligatoires devront être validés avant la publication en production.

### 20.6. Tests de non-régression

Une suite de tests de non-régression sera maintenue afin de vérifier que les nouvelles modifications ne détériorent pas les fonctionnalités existantes.

Exemple : une évolution du module AgroID ne doit pas casser la création des parcelles, leur géolocalisation, les cycles de culture, les observations ou la synchronisation mobile.

Ces tests seront exécutés automatiquement après les modifications concernées.

### 20.7. Tests de compatibilité mobile et réseau

L'application mobile devra être testée dans différentes conditions d'utilisation.

Les scénarios comprendront :

- Plusieurs tailles d'écran Android.
- Téléphones d'entrée de gamme avec des ressources limitées.
- Connexions 2G, 3G et 4G.
- Utilisation sans connexion Internet.
- Interruptions pendant les transferts de fichiers.
- Synchronisation après plusieurs heures ou jours hors ligne.

L'objectif est de garantir une expérience fiable dans les conditions réelles d'utilisation sur le terrain.

### 20.8. Tests de sécurité

Des tests de sécurité réguliers seront réalisés pour identifier les vulnérabilités potentielles.

Ils couvriront notamment :

- L'isolation des organisations.
- Les contrôles d'accès par rôle.
- La protection des API.
- La sécurisation des fichiers privés.
- La gestion des sessions et des authentifications.
- La validation des données reçues.
- La détection des accès et comportements anormaux.

Des vérifications renforcées seront réalisées avant les mises en production importantes et lors des évolutions sensibles.

### 20.9. Tests de qualité des données

Des mécanismes automatiques devront vérifier la cohérence et la qualité des données enregistrées.

Les contrôles porteront notamment sur :

- Les champs obligatoires manquants.
- Les coordonnées GPS incohérentes.
- Les doublons potentiels de producteurs ou de parcelles.
- Les incohérences de dates et de cycles agricoles.
- Les observations incomplètes.
- Les données non vérifiées ou non validées.
- La cohérence des données utilisées par les analyses IA et le SFA.

Les données suspectes pourront être signalées pour vérification humaine. Elles ne devront pas être supprimées automatiquement sans règle métier appropriée.

### 20.10. Séparation des environnements de test

Les trois environnements définis dans l'architecture seront utilisés :

**Development :**
- Développement des fonctionnalités.
- Tests techniques initiaux.
- Vérifications individuelles.

**Staging :**
- Validation des versions candidates.
- Tests d'intégration et E2E.
- Vérifications fonctionnelles et manuelles.
- Validation avant production.

**Production :**
- Exploitation réelle de la plateforme.
- Surveillance du fonctionnement.
- Contrôles après déploiement.

Les environnements devront rester isolés.

Les tests utiliseront des données fictives ou anonymisées lorsque cela est nécessaire. Les données réelles de production ne devront pas être copiées librement vers les environnements de développement ou de test.

### 20.11. Suivi de la qualité des tests

PEST AI OS devra conserver un suivi régulier de la qualité des tests.

Les indicateurs comprendront :

- Le taux de couverture du code par les tests.
- Le nombre de tests réussis et échoués.
- Les fonctionnalités insuffisamment testées.
- Les erreurs détectées.
- Les erreurs corrigées et encore ouvertes.
- L'historique des exécutions.
- Les résultats des tests avant déploiement.

La couverture du code constitue un indicateur de suivi, mais ne garantit pas à elle seule la qualité des tests. La pertinence des scénarios devra également être évaluée.

### 20.12. Gestion des anomalies

Toute anomalie détectée devra pouvoir être enregistrée et suivie.

Chaque anomalie importante devra comporter :

- Une description du problème.
- Le module concerné.
- Les étapes permettant de reproduire le problème.
- Le niveau de gravité.
- Le statut de correction.
- La personne responsable.
- Le résultat du nouveau test après correction.

Les anomalies critiques devront être traitées en priorité et faire l'objet d'une validation avant la mise en production.

### 20.13. Principes généraux d'assurance qualité

Les principes suivants devront être respectés :

- Toute fonctionnalité importante doit disposer de scénarios de test.
- Les contrôles automatiques doivent être intégrés au cycle de développement.
- Les modifications sensibles doivent être vérifiées avant leur publication.
- Les erreurs critiques doivent être corrigées avant la mise en production.
- Les tests doivent évoluer avec les fonctionnalités.
- Les résultats des tests doivent être conservés et consultables par l'équipe technique.

L'assurance qualité est un processus continu, appliqué pendant le développement, les évolutions et l'exploitation de PEST AI OS.
