# PEST AI OS — Data Model

**Version:** 1.0  
**Status:** Draft — Référentiel conceptuel des données  
**Project:** PEST AI OS

---

## 1. Objectif du document

Ce document définit le référentiel conceptuel des données de PEST AI OS.

Il identifie les principales entités métier, leurs responsabilités, les domaines auxquels elles appartiennent et leurs relations fonctionnelles.

Il servira de base à la conception du modèle relationnel, des tables, des clés primaires et étrangères, des contraintes d'intégrité et des diagrammes Entity Relationship Diagram (ERD).

Le modèle doit couvrir :

- Les fonctionnalités du MVP.
- Les modules prévus dans les phases ultérieures.
- Les relations entre les différents domaines.
- La traçabilité des opérations agricoles, techniques et financières.
- L'évolution de la plateforme sans refonte majeure.

**Important :** ce document décrit le modèle conceptuel cible. Il ne constitue pas encore le schéma SQL définitif.

## 2. Principes de conception

### 2.1. Modèle global et modulaire

Les données sont organisées par domaines fonctionnels. Chaque domaine possède des responsabilités clairement définies.

### 2.2. Source de vérité

Une information métier doit avoir une entité de référence unique. Les modules ne doivent pas créer des copies indépendantes d'une même donnée sans justification.

### 2.3. Multi-organisation

Les données appartenant à une organisation doivent être isolées selon les règles d'accès. Les relations entre utilisateurs, producteurs, parcelles et organisations doivent être explicites.

### 2.4. Traçabilité

Les événements importants doivent pouvoir être retracés : création, modification, validation, analyse, intervention, consommation de service et transaction financière.

### 2.5. Historisation

Les données dont l'évolution présente une valeur métier doivent conserver leur historique lorsque cela est nécessaire.

### 2.6. Géospatial

Les parcelles, zones géographiques, images et observations spatiales doivent être compatibles avec PostgreSQL et PostGIS.

### 2.7. Évolutivité

Les entités prévues pour les phases futures doivent être anticipées conceptuellement, mais leur implémentation peut être différée.

## 3. Domaine 1 — Identité, utilisateurs et organisations

Ce domaine gère les identités, les organisations et les autorisations d'accès.

| Entité | Responsabilité |
|---|---|
| Organization | Coopérative, entreprise, institution ou organisation utilisant PEST AI OS |
| User | Compte utilisateur de la plateforme |
| OrganizationMembership | Relation entre un utilisateur et une organisation |
| Role | Rôle attribué à un utilisateur |
| Permission | Autorisation associée à une fonctionnalité ou une ressource |
| ProgramMembership | Participation d'un utilisateur ou d'une organisation à un programme agricole |

### Relations fonctionnelles

- Une organisation peut avoir plusieurs membres.
- Un utilisateur peut appartenir à plusieurs organisations.
- Une appartenance à une organisation peut être associée à un ou plusieurs rôles selon les règles retenues.
- Un rôle regroupe plusieurs permissions.
- Un utilisateur peut participer à plusieurs programmes.

### Principes

L'identité d'un utilisateur doit être indépendante de son rôle métier. Un utilisateur peut être producteur dans un contexte et agent ou administrateur dans un autre, selon les autorisations accordées.

## 4. Domaine 2 — Producteurs, agents et agronomes

Ce domaine représente les acteurs agricoles et leurs affectations.

| Entité | Responsabilité |
|---|---|
| Producer | Profil métier du producteur agricole |
| ProducerContact | Coordonnées et moyens de contact du producteur |
| ProducerOrganizationAssignment | Relation entre un producteur et une organisation |
| FieldAgent | Profil métier d'un agent terrain |
| AgronomistProfile | Profil métier d'un agronome |

### Relations fonctionnelles

- Un producteur peut être associé à plusieurs organisations.
- Une organisation peut accompagner plusieurs producteurs.
- Un producteur peut être associé à plusieurs parcelles.
- Un agent peut intervenir sur plusieurs missions.
- Un agronome peut valider plusieurs analyses et recommandations.

### Principes

Le profil métier Producer ne doit pas être confondu avec le compte User. Un producteur peut être enregistré dans le système avant de disposer de son propre compte utilisateur.

## 5. Domaine 3 — Parcelles et AgroID

Ce domaine constitue le cœur du référentiel agricole de PEST AI OS.

| Entité | Responsabilité |
|---|---|
| Parcel | Parcelle agricole identifiée dans la plateforme |
| ParcelGeometry | Géométrie géographique de la parcelle |
| ParcelAssignment | Affectation d'une parcelle à un producteur ou à un responsable |
| ParcelOwnership | Informations relatives à la propriété ou au droit d'exploitation |
| CultivationUnit | Unité de culture ou subdivision opérationnelle d'une parcelle |
| GeographicZone | Zone géographique ou agroécologique |

### Relations fonctionnelles

- Une parcelle possède un identifiant AgroID unique.
- Une parcelle peut avoir une ou plusieurs versions de géométrie au fil du temps.
- Une parcelle peut être associée à plusieurs affectations successives.
- Un producteur peut être associé à plusieurs parcelles.
- Une parcelle peut contenir plusieurs unités de culture.
- Une parcelle est localisée dans une zone géographique.
- Une parcelle peut être associée à plusieurs campagnes agricoles.

### Principes

AgroID représente l'identité numérique durable de la parcelle.

La géométrie, les affectations, les cultures et les données historiques ne doivent pas être confondues avec cette identité.

Les modifications géographiques et administratives importantes doivent pouvoir être historisées.

## 6. Domaine 4 — Gestion agricole

Ce domaine décrit les cultures, les campagnes et les cycles agricoles.

| Entité | Responsabilité |
|---|---|
| AgriculturalCampaign | Campagne agricole |
| CropCycle | Cycle de culture associé à une parcelle ou unité de culture |
| Crop | Culture agricole |
| CropVariety | Variété d'une culture |
| CropStage | Stade de développement agricole |
| CropCalendar | Calendrier cultural de référence |

### Relations fonctionnelles

- Une campagne peut contenir plusieurs cycles de culture.
- Une parcelle peut accueillir plusieurs cycles au fil du temps.
- Un cycle de culture est associé à une culture.
- Une culture peut avoir plusieurs variétés.
- Un cycle peut traverser plusieurs stades de développement.
- Un calendrier cultural peut servir de référence à plusieurs cycles.

### Principes

Il faut distinguer la culture déclarée, la culture effectivement observée et la culture confirmée lorsque ces informations diffèrent.

L'historique des campagnes doit être conservé afin de permettre les analyses agricoles longitudinales.

## 7. Domaine 5 — Missions et opérations terrain

Ce domaine gère le travail des agents et les informations collectées sur le terrain.

| Entité | Responsabilité |
|---|---|
| FieldMission | Mission terrain |
| MissionAgent | Affectation d'un agent à une mission |
| MissionParcel | Parcelles concernées par une mission |
| FieldVisit | Visite effectuée sur le terrain |
| FieldVisitReport | Rapport associé à une visite |
| Observation | Observation agricole ou environnementale |
| ObservationMedia | Photo, vidéo ou média associé à une observation |

### Relations fonctionnelles

- Une mission peut concerner plusieurs parcelles.
- Une mission peut mobiliser plusieurs agents.
- Un agent peut participer à plusieurs missions.
- Une mission peut générer plusieurs visites.
- Une visite peut produire plusieurs observations.
- Une visite peut être associée à un rapport.
- Une observation peut contenir plusieurs médias.
- Une observation peut déclencher une analyse IA.

### Principes

Les données collectées hors connexion doivent pouvoir être synchronisées sans perdre leur origine, leur date de collecte et leur auteur.

Les observations déclarées par un utilisateur doivent rester distinguables des conclusions générées par l'IA.

## 8. Domaine 6 — Intelligence artificielle et recommandations

Ce domaine gère les traitements IA, les résultats, les validations et les recommandations agricoles.

| Entité | Responsabilité |
|---|---|
| AIAnalysisJob | Tâche d'analyse IA |
| AIModel | Modèle d'intelligence artificielle |
| AIModelVersion | Version d'un modèle |
| Diagnostic | Résultat d'une analyse agricole |
| DiagnosticEvidence | Élément justifiant ou documentant un diagnostic |
| DiagnosticReview | Validation ou correction par un expert |
| Recommendation | Recommandation produite |
| RecommendationAction | Action concrète associée à une recommandation |
| RecommendationFollowup | Suivi de l'exécution d'une recommandation |
| AgriculturalProduct | Référentiel canonique des produits agricoles |
| ProductRecommendation | Association entre une recommandation et un produit |

### Relations fonctionnelles

- Une observation peut déclencher une ou plusieurs analyses.
- Une tâche d'analyse utilise un modèle et une version identifiables.
- Une tâche peut produire un diagnostic.
- Un diagnostic peut contenir plusieurs éléments de preuve.
- Un diagnostic peut faire l'objet de plusieurs validations ou révisions.
- Un diagnostic peut générer plusieurs recommandations.
- Une recommandation peut contenir plusieurs actions.
- Une recommandation peut être suivie dans le temps.
- Une recommandation peut référencer un ou plusieurs produits agricoles.

### Principes

Les résultats IA doivent conserver leur provenance, leur date, leur modèle et leur version.

Une recommandation générée par l'IA ne doit pas être confondue avec une recommandation validée par un agronome.

Le référentiel AgriculturalProduct doit être unique dans le système. Les offres commerciales des fournisseurs doivent être gérées dans un domaine distinct.

## 9. Domaine 7 — Géospatial, télédétection et données environnementales

Ce domaine enrichit les informations des parcelles avec les données spatiales et environnementales.

| Entité | Responsabilité |
|---|---|
| SatelliteImage | Image satellitaire acquise |
| GeospatialLayer | Couche géospatiale |
| VegetationIndex | Indicateur calculé à partir de données d'imagerie |
| WeatherRecord | Donnée météorologique |
| MicroclimateRecord | Donnée microclimatique |
| DroneMission | Mission de collecte par drone |
| DroneFlight | Vol effectué |
| DroneImage | Image collectée par drone |
| Orthomosaic | Image assemblée et géoréférencée |
| GeospatialProcessingJob | Traitement géospatial |
| SensorDevice | Équipement ou capteur |
| SensorMeasurement | Mesure collectée par un capteur |

### Relations fonctionnelles

- Une image satellitaire peut couvrir plusieurs parcelles.
- Une image peut être associée à plusieurs couches ou traitements.
- Un indice de végétation est calculé à partir de données d'imagerie compatibles.
- Une donnée météorologique est associée à une localisation et une période.
- Une mission drone peut comporter plusieurs vols.
- Un vol peut produire plusieurs images.
- Plusieurs images peuvent contribuer à une orthomosaïque.
- Un traitement géospatial peut produire plusieurs résultats.
- Un capteur peut être associé à une parcelle.
- Un capteur peut produire plusieurs mesures.

### Principes

Les fichiers d'imagerie doivent être conservés dans un stockage objet. La base relationnelle conserve leurs métadonnées, références et relations métier.

Les indices NDVI, NDWI ou NDRE ne doivent être calculés que lorsque les bandes spectrales nécessaires sont disponibles.

Une anomalie issue d'une image ou d'un capteur constitue un signal à examiner et non un diagnostic définitif.

## 10. Domaine 8 — Fary et intelligence conversationnelle

Ce domaine gère les interactions textuelles et vocales.

| Entité | Responsabilité |
|---|---|
| Conversation | Conversation entre un utilisateur et le système |
| ConversationParticipant | Participant à une conversation |
| Message | Message textuel ou vocal |
| MessageAttachment | Pièce jointe associée à un message |
| VoiceProcessingJob | Tâche de traitement vocal |
| VoiceTranscription | Transcription d'un message vocal |
| AIInteraction | Interaction avec un service ou modèle IA |
| AgriculturalMemory | Information agricole conservée en mémoire contextuelle |

### Relations fonctionnelles

- Une conversation contient plusieurs messages.
- Une conversation peut avoir plusieurs participants.
- Un message peut contenir plusieurs pièces jointes.
- Un message vocal peut déclencher un traitement vocal.
- Un traitement vocal peut produire une transcription.
- Une conversation peut déclencher plusieurs interactions IA.
- Une interaction peut utiliser des informations issues de la mémoire agricole.
- Une mémoire agricole peut être associée à un producteur, une parcelle ou un cycle agricole.

### Principes

La mémoire agricole doit être sélective et contextualisée.

Elle doit distinguer :
- Les informations déclarées par le producteur.
- Les hypothèses produites par l'IA.
- Les informations validées par un agronome.

La conservation des conversations et des mémoires doit respecter les règles de confidentialité et de consentement.

## 11. Domaine 9 — Wallet, crédits, consommation et facturation

Ce domaine gère la monétisation des services PEST AI.

| Entité | Responsabilité |
|---|---|
| Wallet | Portefeuille d'un utilisateur ou d'une organisation |
| WalletTransaction | Mouvement financier du portefeuille |
| CreditLot | Lot de crédits achetés ou promotionnels |
| ServiceUsage | Consommation d'un service |
| UsageReservation | Réservation de crédits avant exécution |
| BillingRecord | Enregistrement de facturation |
| OrganizationBudget | Budget alloué à une organisation |

### Relations fonctionnelles

- Un utilisateur ou une organisation peut posséder un portefeuille selon les règles métier.
- Un portefeuille contient plusieurs transactions.
- Un portefeuille peut disposer de plusieurs lots de crédits.
- Une consommation de service peut être associée à une réservation.
- Une réservation peut entraîner un débit définitif ou être libérée.
- Une consommation peut être associée à une facture.
- Une organisation peut disposer de plusieurs budgets ou allocations.

### Principes financiers obligatoires

- Les crédits achetés ne périment pas.
- Les crédits promotionnels peuvent expirer.
- Le coût d'une opération est affiché avant confirmation.
- Une opération payante doit être autorisée financièrement avant son exécution.
- Le système réserve les crédits nécessaires avant traitement.
- Le débit définitif intervient après réussite.
- En cas d'échec, la réservation est libérée ou remboursée.
- Les opérations financières doivent être idempotentes.
- Les transactions doivent être historisées et auditables.
- Le registre financier doit éviter toute modification rétroactive des mouvements validés.

Le modèle relationnel devra permettre de distinguer le payeur, le bénéficiaire, le service consommé et l'organisation qui finance l'opération.

## 12. Domaine 10 — Catalogue agricole et fournisseurs

Ce domaine gère les produits agricoles et les offres des fournisseurs.

| Entité | Responsabilité |
|---|---|
| Supplier | Fournisseur de produits ou services agricoles |
| SupplierProduct | Offre d'un fournisseur pour un produit |
| AgriculturalProduct | Référentiel central des produits agricoles |
| ProductCategory | Catégorie de produits |

### Relations fonctionnelles

- Un fournisseur peut proposer plusieurs offres.
- Une offre référence un produit du catalogue central.
- Un produit peut être proposé par plusieurs fournisseurs.
- Un produit peut appartenir à une catégorie.
- Une recommandation IA peut référencer un produit du catalogue.

### Principes

Il faut distinguer le produit agricole de son offre commerciale.

Le prix, la disponibilité et les conditions commerciales appartiennent à l'offre du fournisseur et non au référentiel central du produit.

## 13. Domaine 11 — Notifications, appareils, synchronisation et gouvernance

Ce domaine regroupe les fonctions transversales.

| Entité | Responsabilité |
|---|---|
| Notification | Notification envoyée à un utilisateur |
| NotificationPreference | Préférences de notification |
| Device | Appareil associé à un utilisateur |
| SyncOperation | Opération de synchronisation |
| SyncConflict | Conflit détecté lors d'une synchronisation |
| AuditLog | Historique des actions sensibles |
| SystemEvent | Événement technique ou métier |
| FileAsset | Référence vers un fichier stocké |
| SupportTicket | Demande d'assistance |
| SystemConfiguration | Configuration du système |

### Relations fonctionnelles

- Un utilisateur peut recevoir plusieurs notifications.
- Un utilisateur peut posséder plusieurs appareils.
- Un appareil peut transmettre plusieurs opérations de synchronisation.
- Une opération peut produire un conflit.
- Les actions sensibles peuvent produire des journaux d'audit.
- Les événements peuvent être associés à un utilisateur, une organisation ou un objet métier.
- Les fichiers peuvent être associés à plusieurs domaines métier selon les règles de rattachement.
- Les tickets d'assistance peuvent être associés à un utilisateur ou une organisation.

### Principes

Les mécanismes transversaux doivent être réutilisables par tous les modules.

Les journaux d'audit ne doivent pas être confondus avec les événements techniques ou les historiques métier.

## 14. Principales relations inter-domaines

Les relations suivantes constituent les parcours fondamentaux du système.

### 14.1. Parcours agricole

Organization → Producer → Parcel → AgriculturalCampaign → CropCycle → FieldMission → FieldVisit → Observation → AIAnalysisJob → Diagnostic → Recommendation.

### 14.2. Parcours AgroID

Parcel → ParcelGeometry → GeographicZone.

Parcel → ParcelAssignment → Producer.

Parcel → CropCycle → AgriculturalCampaign.

Parcel → SatelliteImage / SensorMeasurement / DroneMission.

### 14.3. Parcours intelligence artificielle

Observation → AIAnalysisJob → AIModelVersion → Diagnostic → DiagnosticReview → Recommendation → RecommendationFollowup.

### 14.4. Parcours Fary

Producer → Conversation → Message → VoiceProcessingJob → VoiceTranscription → AIInteraction → AgriculturalMemory.

### 14.5. Parcours financier

User ou Organization → Wallet → CreditLot → UsageReservation → ServiceUsage → WalletTransaction → BillingRecord.

### 14.6. Parcours SFA

Producer → Parcel → CropCycle → Observation → DiagnosticReview → Données agricoles historiques → Indicateurs de fiabilité → SFA.

Le SFA doit pouvoir expliquer les informations utilisées pour produire un score et conserver son historique d'évolution.

## 15. Entités à implémenter selon les phases

Le modèle global doit être anticipé dès la conception, mais les entités ne doivent pas toutes être développées dans le MVP.

| Domaine | MVP | Phases ultérieures |
|---|---|---|
| Identité et organisations | Organization, User, OrganizationMembership, Role, Permission | ProgramMembership avancé |
| Producteurs et acteurs | Producer, ProducerContact, ProducerOrganizationAssignment | Profils et affectations avancés |
| AgroID | Parcel, ParcelGeometry, ParcelAssignment, GeographicZone | Historique géospatial avancé, CultivationUnit |
| Agriculture | Crop, CropVariety, AgriculturalCampaign, CropCycle | CropStage, CropCalendar avancé |
| Terrain | FieldMission, MissionAgent, MissionParcel, FieldVisit, FieldVisitReport, Observation, ObservationMedia | Workflows avancés |
| IA | Structure préparatoire et premières analyses selon le périmètre pilote | Gestion complète des modèles, diagnostics et recommandations |
| Géospatial | Géométrie et localisation des parcelles | SatelliteImage, VegetationIndex, DroneMission, Orthomosaic |
| Capteurs | Préparation du rattachement | SensorDevice, SensorMeasurement, AgroShield |
| Fary | Architecture préparatoire | Conversation, Message, ASR, TTS, AgriculturalMemory |
| Finances | Préparation des règles et interfaces | Wallet, CreditLot, ServiceUsage, SFA, BillingRecord |
| Catalogue | Référentiel initial si nécessaire | Fournisseurs et offres commerciales |
| Transversal | FileAsset, Device, SyncOperation, AuditLog | Notifications avancées, support et gouvernance avancée |

Cette répartition est indicative et doit être confirmée selon les scénarios prioritaires du pilote MVP.

## 16. Points de conception à résoudre lors du passage au modèle relationnel

Les décisions suivantes doivent être examinées avant de produire le schéma définitif.

1. Déterminer les clés primaires de chaque entité.
2. Déterminer les clés étrangères et les cardinalités.
3. Définir les règles de suppression, d'archivage et de conservation.
4. Définir les entités avec historisation.
5. Définir les relations multi-organisation.
6. Déterminer les relations entre User et les profils métier.
7. Définir la gestion des parcelles partagées ou exploitées par plusieurs producteurs.
8. Définir les relations entre parcelles, unités de culture et cycles agricoles.
9. Définir les règles de versionnement des géométries.
10. Définir les relations entre observations, analyses, diagnostics et validations.
11. Définir la gestion des médias et du stockage objet.
12. Définir les règles de conservation des conversations et mémoires agricoles.
13. Définir le modèle comptable du Wallet et les règles d'idempotence.
14. Définir les relations entre organisations, budgets, portefeuilles et consommateurs.
15. Définir les relations entre fournisseurs, produits et offres commerciales.
16. Définir les relations entre images satellitaires, vols, images drones et orthomosaïques.
17. Définir les règles de consentement et de partage des données SFA.

## 17. Contraintes techniques de référence

Le modèle relationnel devra être compatible avec :

- PostgreSQL comme base relationnelle principale.
- PostGIS pour les données géospatiales.
- Django ORM pour la couche d'accès aux données.
- Django REST Framework pour les APIs.
- Stockage objet compatible S3 pour les images, vidéos, fichiers et médias volumineux.
- Celery et Redis pour les traitements asynchrones.
- Des mécanismes de synchronisation adaptés aux applications mobiles hors ligne.

Les fichiers lourds ne doivent pas être stockés directement dans les tables relationnelles. La base conserve leurs références, métadonnées et relations métier.

## 18. Résultat attendu

Le modèle de données doit permettre à PEST AI OS de construire une représentation numérique cohérente de chaque parcelle et de son historique.

Le système doit pouvoir relier les producteurs, les organisations, les parcelles, les campagnes, les observations, les analyses IA, les données géospatiales, les recommandations et les services financiers.

**Le principe central est le suivant : chaque donnée doit avoir une origine identifiable, un contexte agricole, une relation métier claire et un niveau de traçabilité adapté à son usage.**

Ce document constitue la référence conceptuelle à partir de laquelle sera produit le modèle relationnel détaillé et ses diagrammes ERD.
