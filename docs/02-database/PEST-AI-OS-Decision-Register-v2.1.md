# PEST AI OS — Decision Register v2.1

**Projet :** PEST AI OS — Database Design MVP  
**Date :** 20 novembre 2026  
**Remplace :** Decision Register v2.0 (v2.1 : ajout des précisions techniques T-01 à T-04 et précision de la réserve D-04 ; aucune décision métier ajoutée ni modifiée)  
**Document associé :** `PEST-AI-OS-Database-Design-MVP-Scope-v2.2.pdf` (chapitres 15 et 16)  
**Statut du registre :** toutes les décisions sont validées par le fondateur ; aucune décision ouverte. Conception en attente d'approbation finale avant tout développement.

## Lecture

| Statut | Signification |
|---|---|
| Validée | Décision du fondateur ou décision technique cohérente avec l'architecture |
| Validée avec réserves | Recommandation validée ; les réserves du fondateur s'appliquent à la mise en œuvre |
| Arbitrage validé | Arbitrage stratégique tranché par le fondateur (droits, données, confidentialité, périmètre) |

Total : 17 décisions du fondateur (F-01 à F-17) et 29 décisions consolidées (D-01 à D-29) — 20 techniques, 6 validées avec réserves, 3 arbitrages.

## 1. Décisions du fondateur

| ID | Décision | Contenu | Statut | Origine |
|---|---|---|---|---|
| F-01 | Périmètre MVP | Utilisateurs et authentification ; multi-organisation ; rôles et permissions ; producteurs, agents, agronomes ; organisations, coopératives et programmes (ONG) ; parcelles et AgroID ; propriétaire / exploitant historisés ; CultivationUnit ; cultures, variétés, campagnes, cycles ; missions, visites, observations ; FileAsset ; opérations agricoles essentielles et récoltes ; diagnostic IA limité aux 5 cultures avec validation agronomique ; recommandations validées par un agronome ; synchronisation hors ligne ; notifications internes, push et SMS critiques ; tableaux de bord essentiels par rôle ; audit ; appareils et synchronisation. | Validée par le fondateur | Mission 2 |
| F-02 | Fonctionnalités reportées | SFA (Phase 2), exploitation satellite (Phase 2), banques et assurances, Wallet et finance avancée, fournisseurs et commandes avancés, AgroShield/IoT, drones, Fary ASR/TTS avancé, analyses avancées de rendement et de coûts, reporting avancé : points d'extension uniquement. | Validée par le fondateur | Mission 2 |
| F-03 | Stack technique | Python 3.12, Django 5.2 LTS, Django REST Framework, PostgreSQL 16 + PostGIS, monolithe modulaire, Celery + Redis, environnements Development / Staging / Production. | Validée par le fondateur | Mission 2 |
| F-04 | Identifiants et API | UUID comme identifiant technique ; API versionnée /api/v1/. | Validée par le fondateur | Mission 2 |
| F-05 | Authentification | Téléphone + mot de passe ; JWT avec access token court et refresh token. | Validée par le fondateur | Mission 2 |
| F-06 | Multi-organisation | Un utilisateur peut appartenir à plusieurs organisations ; rôles et permissions dépendants du contexte ; vérification de l'appartenance et des autorisations côté backend à chaque requête ; aucun accès transversal non autorisé. | Validée par le fondateur | Mission 2 |
| F-07 | Fichiers | FileAsset centralise les métadonnées ; binaires en stockage objet compatible S3 (Cloudflare R2 envisagé) ; rattachements aux parcelles, missions, observations, diagnostics ; isolation respectée. | Validée par le fondateur | Mission 2 |
| F-08 | AgroID | Unique, permanent, non réutilisable ; format PAI-SN-7K4M9X2Q ; indépendant du propriétaire et de l'exploitant ; distinct de l'UUID. | Validée par le fondateur | Mission 2 |
| F-09 | Propriété et exploitation | Propriétaire et exploitant distincts, relations historisées avec dates de début et de fin, historique jamais écrasé. | Validée par le fondateur | Mission 2 |
| F-10 | CultivationUnit | Plusieurs unités par parcelle ; culture et cycle par unité ; missions, observations et diagnostics rattachables à une unité. | Validée par le fondateur | Mission 2 |
| F-11 | Diagnostic IA | Résultat IA = prédiction préliminaire ; confiance, modèle et version conservés ; validation obligatoire par un agronome ; recommandations de traitement validées par un agronome ; décisions, auteurs, dates et historiques conservés. | Validée par le fondateur | Mission 2 |
| F-12 | Synchronisation hors ligne | UUID unique par opération ; appareil, utilisateur, date et statut conservés ; idempotence, détection des doublons et des conflits ; aucun écrasement automatique de données sensibles en conflit. | Validée par le fondateur | Mission 2 |
| F-13 | Suppression | Archivage logique des données métier importantes ; conservation des historiques et journaux ; suppression physique encadrée par la politique de conservation. | Validée par le fondateur | Mission 2 |
| F-14 | Tests | Tests unitaires, d'intégration, API, sécurité multi-organisation, synchronisation hors ligne et parcours fonctionnels. | Validée par le fondateur | Mission 2 |
| F-15 | Catalogue agricole | AgriculturalProduct (référentiel canonique), SupplierProduct (offre fournisseur) et ProductRecommendation (lien produit ↔ recommandation) restent distincts ; un produit peut avoir plusieurs offres et être recommandé dans plusieurs contextes. | Validée par le fondateur | AUD §2.7 ; Missions 3 et finale |
| F-16 | Sept rôles système | super_admin, organization_admin, cooperative_manager, field_agent, agronomist, producer, program_manager — exactement, aucun autre ; plusieurs rôles par utilisateur selon l'organisation ; permissions plateforme et organisation distinctes ; Super Admin traité au niveau plateforme. | Validée par le fondateur | v1.1 |
| F-17 | Producteur indépendant ou rattaché | Compte producteur sans adhésion obligatoire ; rattachement possible à une ou plusieurs organisations ; aucun accès automatique aux données d'une organisation via une parcelle possédée ou exploitée ; droits personnels et droits d'organisation séparés ; vérification backend de chaque accès ; historique conservé ; rôle producer attribué dans une organisation, pas de huitième rôle. | Validée par le fondateur | v1.2 |

## 2. Arbitrages stratégiques validés

### D-04 — Visibilité des programmes pour l'organisation porteuse

- **Statut :** Arbitrage validé (fondateur, v2.1)
- **Décision :** Niveau de partage par participation (ProgramOrganization.data_sharing_level). aggregated (défaut) : l'organisation porteuse reçoit uniquement des indicateurs globaux, des effectifs (bénéficiaires, parcelles, surfaces) et les résultats du programme, calculés côté serveur ; aucun nom de bénéficiaire, aucune parcelle identifiable (AgroID, géométrie, localisation), aucune donnée individuelle. detailed : lecture seule des enregistrements de la participante limités au programme, uniquement après autorisation explicite de son organization_admin (sharing_decided_by, sharing_decided_at) ; chaque consultation est journalisée (AuditLog program_detailed_access) ; droits vérifiés côté backend.
- **Justification :** Protège par défaut les données des coopératives tout en permettant le suivi des bailleurs ; la décision revient à l'organisation qui détient les données.
- **Conséquences sur le modèle :** ProgramOrganization : data_sharing_level, sharing_decided_by, sharing_decided_at. ProgramBeneficiary et ProgramParcel visibles par l'organisation qui les a inscrits, et par la porteuse seulement en detailed. Endpoints d'indicateurs agrégés distincts des endpoints de liste. Permissions programs.view_aggregated et programs.view_detailed_data. AuditLog program_detailed_access.
- **Réserves :** Arbitrage stratégique validé. Réserve technique : masquage des petits effectifs dans les indicateurs pour éviter toute ré-identification ; seuil paramétrable (configuration plateforme), valeur à confirmer — une valeur de 5 est seulement une proposition technique, pas une décision du fondateur.

### D-12 — Diagnostic IA pour le producteur indépendant

- **Statut :** Arbitrage validé (fondateur, v2.1)
- **Décision :** Diagnostic IA ouvert aux producteurs indépendants dans le MVP, pour les cinq cultures prioritaires, avec consentement explicite du producteur à chaque demande (AIAnalysisJob.consent_given_by, consent_given_at, consent_text_version). Le consentement ouvre à l'équipe agronomique PEST AI la lecture de cette observation et de ses fichiers, via la file de revue, de façon journalisée. Validation obligatoire par un agronome PEST AI (AgronomistAssignment active sur l'organisation pest_ai) ; agronome responsable, modèle, version, confiance et historique des revues conservés. Un résultat non validé n'est jamais présenté comme un diagnostic confirmé.
- **Justification :** Préserve la règle de validation agronomique obligatoire et la séparation des espaces ; décision qui engage les ressources agronomiques et le modèle économique.
- **Conséquences sur le modèle :** AIAnalysisJob, Diagnostic, DiagnosticEvidence et DiagnosticReview passent au mixin SPACE. AIAnalysisJob : champs de consentement + CHECK. Diagnostic : assigned_agronomist + CHECK confirmé ⇒ revue existante. Permissions personal.diagnostics.request et personal.diagnostics.view. AuditLog diagnostic_consent. Organisation PEST AI (pest_ai) et affectations de ses agronomes à créer au démarrage.
- **Réserves :** Arbitrage stratégique validé. Réserve opérationnelle : dimensionnement de l'équipe agronomique PEST AI ; les recommandations pour les producteurs indépendants ne sont pas couvertes par D-12 et restent réservées aux espaces d'organisation.

### D-25 — Fournisseur IA externe

- **Statut :** Arbitrage validé (fondateur, v2.1)
- **Décision :** Modèles internes PEST AI privilégiés pour le MVP. Aucune donnée personnelle ni localisation précise transmise à un fournisseur externe. Si un service externe devient techniquement indispensable : données strictement nécessaires, images nettoyées de leurs métadonnées EXIF et GPS, fournisseur, modèle, version et traitements tracés, garanties de confidentialité et de sécurité documentées avant l'intégration (AIModel.data_protection_assessment). Ce n'est pas une interdiction définitive d'intégration externe.
- **Justification :** Décision de confidentialité et de souveraineté des données, avec impact sur les coûts.
- **Conséquences sur le modèle :** AIModel.provider, provider_name, data_protection_assessment (+ CHECK) ; nettoyage des métadonnées avant envoi ; AuditLog external_ai_call.
- **Réserves :** Arbitrage stratégique validé ; pas d'interdiction définitive d'intégration externe.

## 3. Registre des décisions consolidées

| ID | Sujet | Cat. | Décision | Statut | Réserves |
|---|---|---|---|---|---|
| D-01 | Contexte de la requête | A | En-tête X-Workspace obligatoire sur les routes métier : « org:<uuid> » ou « personal ». Résolu par un middleware unique de l'application core : adhésion active + rôles (organisation) ou profil Producer actif (personnel). Absent ou invalide : 400 ; non autorisé : 403 + AuditLog. Aucun contexte par défaut. | Validée (fondateur, v2.1) | — |
| D-02 | Origines de l'accès personnel aux parcelles | B | self_registered : créé automatiquement quand le producteur enregistre une parcelle (manage). granted_by_organization : accordé par organization_admin ou cooperative_manager d'une organisation ayant un ParcelOrganizationLink actif (view par défaut). verified_claim : valeur réservée, NON utilisée au MVP ; seul super_admin pourra la créer, avec justification et AuditLog, quand une procédure de vérification existera. | Validée avec réserves (fondateur, v2.1) | Distinction stricte entre droits personnels et droits d'adhésion (réserve du fondateur). |
| D-03 | Lien d'une parcelle personnelle à une organisation | A | ParcelOrganizationLink créé en pending_producer_consent ; actif seulement après acceptation du producteur (consented_by, consented_at). Refus ou absence de réponse : aucun accès. Le lien ne transfère aucune donnée de l'espace personnel. | Validée (fondateur, v2.1) | — |
| D-04 | Visibilité des programmes pour l'organisation porteuse | C | Niveau de partage par participation (ProgramOrganization.data_sharing_level). aggregated (défaut) : l'organisation porteuse reçoit uniquement des indicateurs globaux, des effectifs (bénéficiaires, parcelles, surfaces) et les résultats du programme, calculés côté serveur ; aucun nom de bénéficiaire, aucune parcelle identifiable (AgroID, géométrie, localisation), aucune donnée individuelle. detailed : lecture seule des enregistrements de la participante limités au programme, uniquement après autorisation explicite de son organization_admin (sharing_decided_by, sharing_decided_at) ; chaque consultation est journalisée (AuditLog program_detailed_access) ; droits vérifiés côté backend. | Arbitrage validé (fondateur, v2.1) | Arbitrage stratégique validé. Réserve technique : masquage des petits effectifs dans les indicateurs pour éviter toute ré-identification ; seuil paramétrable (configuration plateforme), valeur à confirmer — une valeur de 5 est seulement une proposition technique, pas une décision du fondateur. |
| D-05 | AgroID | A | Attribution par le serveur lors de la synchronisation ou de la création en ligne : 8 caractères tirés d'un générateur cryptographique dans l'alphabet base32 Crockford (sans I, L, O, U), sans clé de contrôle (format validé), unicité garantie par contrainte UNIQUE + nouvelle tentative en cas de collision. Hors ligne, la parcelle existe avec son UUID et le statut draft, sans AgroID. Jamais réattribué, même pour une parcelle retirée. | Validée (fondateur, v2.1) | — |
| D-06 | Exploitants multiples | B | Un seul exploitant principal actif par parcelle (index unique partiel), co-exploitants autorisés (operator_role = co_operator). CropCycle.operator reprend l'exploitant du cycle. | Validée avec réserves (fondateur, v2.1) | Exploitation et propriété ne doivent jamais être confondues ; périodes d'affectation traçables (réserve du fondateur). |
| D-07 | Propriétaire non enregistré | A | ParcelOwnership accepte owner_name seul (CHECK : exactement un de owner_producer, owner_organization, owner_name), verification_status = declared par défaut. | Validée (fondateur, v2.1) | — |
| D-08 | Données personnelles du producteur | B | Minimisation : pas d'identifiant national, année de naissance seulement, sexe facultatif (utile aux indicateurs de genre des programmes), localité, contacts avec consentement SMS. Toute extension (pièce d'identité pour le futur SFA) relèvera d'un arbitrage au moment du SFA. | Validée avec réserves (fondateur, v2.1) | Minimisation : ne collecter et conserver que les données nécessaires aux fonctionnalités et obligations de PEST AI OS (réserve du fondateur). Réserve juridique : conformité à la loi n° 2008-12. |
| D-09 | Type d'organisation | A | Champ organization_type à valeurs fixes (TextChoices) : cooperative, union, ngo, company, institution, public_agency, pest_ai. | Validée (fondateur, v2.1) | — |
| D-10 | Row-Level Security PostgreSQL | A | Pas de RLS au MVP. Isolation par : contexte vérifié (D-01), managers « scoped » obligatoires, organization_id / personal_producer_id fixés et immuables (trigger BEFORE UPDATE sur les tables TENANT et SPACE), tests d'isolation automatisés sur chaque endpoint. RLS réévaluée avant l'ouverture des API partenaires. | Validée (fondateur, v2.1) | — |
| D-11 | Permissions de portée personal | A | Neuf permissions personal : personal.parcels.register, personal.parcels.view, personal.parcels.manage, personal.parcels.consent_link (D-03), personal.crop_cycles.manage, personal.observations.create, personal.diagnostics.request (D-12, avec consentement), personal.diagnostics.view (diagnostics validés uniquement), personal.workspace.sync. Jamais attribuées par un rôle. | Validée (fondateur, v2.1) | — |
| D-12 | Diagnostic IA pour le producteur indépendant | C | Diagnostic IA ouvert aux producteurs indépendants dans le MVP, pour les cinq cultures prioritaires, avec consentement explicite du producteur à chaque demande (AIAnalysisJob.consent_given_by, consent_given_at, consent_text_version). Le consentement ouvre à l'équipe agronomique PEST AI la lecture de cette observation et de ses fichiers, via la file de revue, de façon journalisée. Validation obligatoire par un agronome PEST AI (AgronomistAssignment active sur l'organisation pest_ai) ; agronome responsable, modèle, version, confiance et historique des revues conservés. Un résultat non validé n'est jamais présenté comme un diagnostic confirmé. | Arbitrage validé (fondateur, v2.1) | Arbitrage stratégique validé. Réserve opérationnelle : dimensionnement de l'équipe agronomique PEST AI ; les recommandations pour les producteurs indépendants ne sont pas couvertes par D-12 et restent réservées aux espaces d'organisation. |
| D-13 | Partage de l'historique personnel avec une organisation | B | MVP : aucun transfert ni partage ; les deux espaces coexistent. Un partage futur passera par un consentement explicite, révocable et tracé (hors MVP, signalé). | Validée avec réserves (fondateur, v2.1) | Aucun transfert automatique ; toute consultation ou transmission future respectera les autorisations et règles de confidentialité (réserve du fondateur). |
| D-14 | Inscription autonome et vérification | A | Vérification du téléphone par OTP SMS obligatoire avant toute écriture (User.phone_verified_at). Codes OTP stockés dans Redis avec expiration (pas de table), limites de tentatives et de fréquence. Parcelles self_registered en statut pending_validation puis active après contrôles géométriques ; chevauchements signalés, jamais d'accès à la parcelle existante. | Validée (fondateur, v2.1) | — |
| D-15 | Personnalisation des rôles | A | Non au MVP : les 7 rôles validés sont des rôles système non modifiables ; seule leur attribution est gérée par les organisations. | Validée (fondateur, v2.1) | — |
| D-16 | Unités de culture | A | Géométrie facultative au MVP (unités déclarées par leur code et leur surface). Si présente : incluse dans la géométrie courante de la parcelle avec une tolérance de 1 m, sinon signalée (flagged). | Validée (fondateur, v2.1) | — |
| D-17 | Cycles concurrents | A | Autorisé (cultures associées) mais signalé à l'organisation ou au producteur ; aucun blocage. | Validée (fondateur, v2.1) | — |
| D-18 | Saisons agricoles | A | rainy (hivernage), cold_dry (contre-saison froide), hot_dry (contre-saison chaude), other. Libellés à faire relire par l'agronome. | Validée (fondateur, v2.1) | — |
| D-19 | Seuils géométriques | A | Valeurs de départ paramétrables (settings) : surface < 50 m² ou > 50 ha → flagged ; précision GPS > 10 m → flagged ; chevauchement > 5 % de la surface → flagged ; auto-intersection, polygone non fermé, SRID ≠ 4326 → rejected. Ajustables après le pilote. | Validée (fondateur, v2.1) | — |
| D-20 | Conflits de synchronisation non sensibles | A | Fusion champ par champ si les champs modifiés sont disjoints ; si un même champ a changé des deux côtés, conflit ouvert. Données sensibles : toujours conflit, jamais d'écrasement (règle validée). | Validée (fondateur, v2.1) | — |
| D-21 | Visite hors mission | A | Oui : FieldVisit.mission facultatif (visite spontanée d'un agent). | Validée (fondateur, v2.1) | — |
| D-22 | Observation du producteur | A | Oui : dans l'espace d'une organisation (source = producer, visit NULL) et dans son espace personnel (personal_producer, visit NULL obligatoire). | Validée (fondateur, v2.1) | — |
| D-23 | Catalogue des produits agricoles | A | Respect de la décision AUD §2.7 : AgriculturalProduct = référentiel canonique (MVP), ProductRecommendation = lien recommandation ↔ produit (MVP), SupplierProduct = offre commerciale d'un fournisseur (concept conservé, distinct, reporté avec la gestion avancée des fournisseurs). Aucune fusion. AgriculturalOperation peut référencer un produit ou un texte libre. | Validée (fondateur, v2.1) | — |
| D-24 | Référentiel phytosanitaire | B | Structure retenue (code, nom, type, cultures) avec statut de validation (draft, validated, retired). Contenu encadré et validé par le responsable agronomique avant l'étape 9, aligné sur les label_map. Les produits (AgriculturalProduct), usages et recommandations ne sont jamais considérés comme approuvés automatiquement : seuls les éléments validated sont utilisables. | Validée avec réserves (fondateur, v2.1) | Rien n'est approuvé automatiquement ; validation par le responsable agronomique (réserve du fondateur). |
| D-25 | Fournisseur IA externe | C | Modèles internes PEST AI privilégiés pour le MVP. Aucune donnée personnelle ni localisation précise transmise à un fournisseur externe. Si un service externe devient techniquement indispensable : données strictement nécessaires, images nettoyées de leurs métadonnées EXIF et GPS, fournisseur, modèle, version et traitements tracés, garanties de confidentialité et de sécurité documentées avant l'intégration (AIModel.data_protection_assessment). Ce n'est pas une interdiction définitive d'intégration externe. | Arbitrage validé (fondateur, v2.1) | Arbitrage stratégique validé ; pas d'interdiction définitive d'intégration externe. |
| D-26 | Notifications SMS critiques | A | SMS réservés à : OTP et sécurité du compte (vérification, réinitialisation, appareil révoqué) ; recommandation de traitement validée de priorité haute ; mission assignée pour le jour même à un agent sans push actif. Tout le reste : in_app et push. Fournisseur SMS : choix d'implémentation derrière un connecteur unique. | Validée (fondateur, v2.1) | — |
| D-27 | Durées de conservation | B | Politique de conservation de référence, PROVISOIRE jusqu'à confirmation juridique avant le pilote : SyncOperation.payload 90 jours (métadonnées conservées) ; ChangeLogEntry 90 jours (au-delà : resynchronisation complète) ; IdempotencyKey 7 jours ; Notification 12 mois ; SyncSession 12 mois ; AuditLog 5 ans ; données métier : archivage logique sans purge au MVP. Purges par tâches Celery tracées. | Validée avec réserves (fondateur, v2.1) | Durées PROVISOIRES : non présentées comme conformes à la réglementation tant que la vérification juridique n'est pas faite (avant le pilote). |
| D-28 | Doublons de producteurs | A | MVP : détection à la création (nom + téléphone + localité) avec avertissement et proposition de rattacher la fiche existante ; pas d'outil de fusion. Fusion assistée hors MVP, réservée à super_admin, sans suppression (signalée). | Validée (fondateur, v2.1) | — |
| D-29 | Division et fusion de parcelles | A | Hors MVP (signalé). Au MVP, une parcelle peut être retirée (status = retired) et une nouvelle créée ; l'AgroID retiré n'est jamais réutilisé. Une table ParcelLineage reliera plus tard les parcelles d'origine et issues. | Validée (fondateur, v2.1) | — |

## 4. Fiches détaillées

### D-01 — Contexte de la requête

- **Catégorie :** A — Décision technique finalisée
- **Origine :** v1.1 n°1 (révisé v1.2)
- **Statut :** Validée (fondateur, v2.1)
- **Problème :** Chaque requête doit indiquer l'espace dans lequel l'utilisateur agit (organisation ou espace personnel) sans que cette valeur ne vaille preuve.
- **Décision :** En-tête X-Workspace obligatoire sur les routes métier : « org:<uuid> » ou « personal ». Résolu par un middleware unique de l'application core : adhésion active + rôles (organisation) ou profil Producer actif (personnel). Absent ou invalide : 400 ; non autorisé : 403 + AuditLog. Aucun contexte par défaut.
- **Justification :** Un seul mécanisme pour le web et le mobile, changement d'espace sans reconnexion (TAS §10.2), pas de jeton par organisation à réémettre.
- **Conséquences :** Aucune table. core : middleware et objet RequestContext. Tous les managers « scoped » lisent ce contexte. Tests d'isolation sur chaque endpoint.
- **Risques :** Oubli de l'en-tête par un client : refus explicite (400) plutôt que contexte implicite.
- **Réserves :** Aucune

### D-02 — Origines de l'accès personnel aux parcelles

- **Catégorie :** B — Recommandation soumise au fondateur
- **Origine :** v1.2
- **Statut :** Validée avec réserves (fondateur, v2.1)
- **Problème :** ProducerParcelAccess prévoit trois origines ; il faut fixer qui peut les créer.
- **Décision :** self_registered : créé automatiquement quand le producteur enregistre une parcelle (manage). granted_by_organization : accordé par organization_admin ou cooperative_manager d'une organisation ayant un ParcelOrganizationLink actif (view par défaut). verified_claim : valeur réservée, NON utilisée au MVP ; seul super_admin pourra la créer, avec justification et AuditLog, quand une procédure de vérification existera.
- **Justification :** Ouvre le cas B sans créer de voie d'accès contestable : aucune revendication non vérifiée ne donne accès à une parcelle enregistrée par une organisation.
- **Conséquences :** ProducerParcelAccess inchangé. Permissions organization : parcels.grant_personal_access (organization_admin, cooperative_manager). Contrôle applicatif : basis = verified_claim implique un acteur super_admin.
- **Risques :** Un producteur réel d'une parcelle enregistrée par une coopérative dépend de celle-ci pour un accès personnel au MVP.
- **Réserves :** Distinction stricte entre droits personnels et droits d'adhésion (réserve du fondateur).

### D-03 — Lien d'une parcelle personnelle à une organisation

- **Catégorie :** A — Décision technique finalisée
- **Origine :** v1.2
- **Statut :** Validée (fondateur, v2.1)
- **Problème :** Une organisation peut vouloir suivre une parcelle qu'un producteur a lui-même enregistrée.
- **Décision :** ParcelOrganizationLink créé en pending_producer_consent ; actif seulement après acceptation du producteur (consented_by, consented_at). Refus ou absence de réponse : aucun accès. Le lien ne transfère aucune donnée de l'espace personnel.
- **Justification :** Applique directement la règle du fondateur : droits personnels et droits d'organisation séparés, aucun accès automatique.
- **Conséquences :** ParcelOrganizationLink.status, consented_by, consented_at (déjà en v1.2). Notification in_app/push au producteur. Permission personal.parcels.consent_link (ajoutée aux permissions personal).
- **Risques :** Délai de réponse du producteur ; prévoir une expiration de la demande (30 jours proposés).
- **Réserves :** Aucune

### D-04 — Visibilité des programmes pour l'organisation porteuse

- **Catégorie :** C — Arbitrage stratégique indispensable
- **Origine :** v1.1 n°3
- **Statut :** Arbitrage validé (fondateur, v2.1)
- **Problème :** Une ONG porteuse de programme peut-elle voir le détail (parcelles, observations, diagnostics) des coopératives participantes ?
- **Décision :** Niveau de partage par participation (ProgramOrganization.data_sharing_level). aggregated (défaut) : l'organisation porteuse reçoit uniquement des indicateurs globaux, des effectifs (bénéficiaires, parcelles, surfaces) et les résultats du programme, calculés côté serveur ; aucun nom de bénéficiaire, aucune parcelle identifiable (AgroID, géométrie, localisation), aucune donnée individuelle. detailed : lecture seule des enregistrements de la participante limités au programme, uniquement après autorisation explicite de son organization_admin (sharing_decided_by, sharing_decided_at) ; chaque consultation est journalisée (AuditLog program_detailed_access) ; droits vérifiés côté backend.
- **Justification :** Protège par défaut les données des coopératives tout en permettant le suivi des bailleurs ; la décision revient à l'organisation qui détient les données.
- **Conséquences :** ProgramOrganization : data_sharing_level, sharing_decided_by, sharing_decided_at. ProgramBeneficiary et ProgramParcel visibles par l'organisation qui les a inscrits, et par la porteuse seulement en detailed. Endpoints d'indicateurs agrégés distincts des endpoints de liste. Permissions programs.view_aggregated et programs.view_detailed_data. AuditLog program_detailed_access.
- **Risques :** Engagements contractuels des bailleurs ; complexité des requêtes inter-organisations (testée spécifiquement).
- **Réserves :** Arbitrage stratégique validé. Réserve technique : masquage des petits effectifs dans les indicateurs pour éviter toute ré-identification ; seuil paramétrable (configuration plateforme), valeur à confirmer — une valeur de 5 est seulement une proposition technique, pas une décision du fondateur.

### D-05 — AgroID

- **Catégorie :** A — Décision technique finalisée
- **Origine :** v1.1 n°4
- **Statut :** Validée (fondateur, v2.1)
- **Problème :** Format validé PAI-SN-XXXXXXXX ; il faut fixer la génération, l'unicité et le cas hors ligne.
- **Décision :** Attribution par le serveur lors de la synchronisation ou de la création en ligne : 8 caractères tirés d'un générateur cryptographique dans l'alphabet base32 Crockford (sans I, L, O, U), sans clé de contrôle (format validé), unicité garantie par contrainte UNIQUE + nouvelle tentative en cas de collision. Hors ligne, la parcelle existe avec son UUID et le statut draft, sans AgroID. Jamais réattribué, même pour une parcelle retirée.
- **Justification :** Respecte le format validé ; 32^8 ≈ 1,1 × 10^12 combinaisons ; un tirage aléatoire évite de révéler des volumes ou des séquences.
- **Conséquences :** Parcel.agroid (CHECK regex, UNIQUE partiel), agroid_assigned_at. Service parcels.assign_agroid transactionnel. Aucune nouvelle table.
- **Risques :** Erreur de saisie manuelle sans clé de contrôle : compensée par la recherche par QR code ou photo de fiche (hors MVP).
- **Réserves :** Aucune

### D-06 — Exploitants multiples

- **Catégorie :** B — Recommandation soumise au fondateur
- **Origine :** v1.1 n°5
- **Statut :** Validée avec réserves (fondateur, v2.1)
- **Problème :** Une parcelle peut être travaillée par plusieurs personnes (exploitation familiale).
- **Décision :** Un seul exploitant principal actif par parcelle (index unique partiel), co-exploitants autorisés (operator_role = co_operator). CropCycle.operator reprend l'exploitant du cycle.
- **Justification :** Donne un interlocuteur clair pour les missions et les statistiques sans nier la réalité familiale.
- **Conséquences :** ParcelOperatorAssignment inchangé (contraintes v1.2).
- **Risques :** Cas d'exploitation collective sans principal : désigner le représentant du groupe.
- **Réserves :** Exploitation et propriété ne doivent jamais être confondues ; périodes d'affectation traçables (réserve du fondateur).

### D-07 — Propriétaire non enregistré

- **Catégorie :** A — Décision technique finalisée
- **Origine :** v1.1 n°6
- **Statut :** Validée (fondateur, v2.1)
- **Problème :** Le propriétaire coutumier ou familial n'est souvent pas un utilisateur ni un producteur enregistré.
- **Décision :** ParcelOwnership accepte owner_name seul (CHECK : exactement un de owner_producer, owner_organization, owner_name), verification_status = declared par défaut.
- **Justification :** Indispensable pour distinguer propriétaire et exploitant sans forcer la création de fiches producteur fictives.
- **Conséquences :** Aucun changement de schéma (v1.0).
- **Risques :** Donnée personnelle d'un tiers : minimisation (nom seul) et visibilité limitée aux rôles habilités.
- **Réserves :** Aucune

### D-08 — Données personnelles du producteur

- **Catégorie :** B — Recommandation soumise au fondateur
- **Origine :** v1.1 n°7
- **Statut :** Validée avec réserves (fondateur, v2.1)
- **Problème :** Quelles données personnelles collecter sur les producteurs ?
- **Décision :** Minimisation : pas d'identifiant national, année de naissance seulement, sexe facultatif (utile aux indicateurs de genre des programmes), localité, contacts avec consentement SMS. Toute extension (pièce d'identité pour le futur SFA) relèvera d'un arbitrage au moment du SFA.
- **Justification :** Réduit l'exposition en cas d'incident et simplifie la conformité ; suffit aux usages du MVP.
- **Conséquences :** Producer inchangé. ProducerContact.sms_consent. Champs sensibles exclus des exports par défaut.
- **Risques :** Doublons plus difficiles à détecter sans identifiant national (voir D-28). Conformité à la loi sénégalaise sur les données personnelles (loi n° 2008-12) à vérifier avec un juriste.
- **Réserves :** Minimisation : ne collecter et conserver que les données nécessaires aux fonctionnalités et obligations de PEST AI OS (réserve du fondateur). Réserve juridique : conformité à la loi n° 2008-12.

### D-09 — Type d'organisation

- **Catégorie :** A — Décision technique finalisée
- **Origine :** v1.1 n°8
- **Statut :** Validée (fondateur, v2.1)
- **Problème :** Entité OrganizationType (TAS) ou valeurs fixes ?
- **Décision :** Champ organization_type à valeurs fixes (TextChoices) : cooperative, union, ngo, company, institution, public_agency, pest_ai.
- **Justification :** Les types ne portent aucun comportement propre au MVP ; une table n'apporterait que de la complexité.
- **Conséquences :** Organization.organization_type (inchangé).
- **Risques :** Ajout d'un type = migration de données légère.
- **Réserves :** Aucune

### D-10 — Row-Level Security PostgreSQL

- **Catégorie :** A — Décision technique finalisée
- **Origine :** v1.1 n°9
- **Statut :** Validée (fondateur, v2.1)
- **Problème :** Ajouter une isolation au niveau de la base en plus des contrôles applicatifs ?
- **Décision :** Pas de RLS au MVP. Isolation par : contexte vérifié (D-01), managers « scoped » obligatoires, organization_id / personal_producer_id fixés et immuables (trigger BEFORE UPDATE sur les tables TENANT et SPACE), tests d'isolation automatisés sur chaque endpoint. RLS réévaluée avant l'ouverture des API partenaires.
- **Justification :** La RLS complique migrations, tâches Celery et tests pour un gain faible tant que seul le backend accède à la base.
- **Conséquences :** core : managers, mixins ; migrations : triggers d'immutabilité. Aucune table.
- **Risques :** Une requête brute mal écrite pourrait contourner les managers : revue de code + test de couverture des managers.
- **Réserves :** Aucune

### D-11 — Permissions de portée personal

- **Catégorie :** A — Décision technique finalisée
- **Origine :** v1.2
- **Statut :** Validée (fondateur, v2.1)
- **Problème :** Fixer la liste des permissions personnelles du producteur (cas B).
- **Décision :** Neuf permissions personal : personal.parcels.register, personal.parcels.view, personal.parcels.manage, personal.parcels.consent_link (D-03), personal.crop_cycles.manage, personal.observations.create, personal.diagnostics.request (D-12, avec consentement), personal.diagnostics.view (diagnostics validés uniquement), personal.workspace.sync. Jamais attribuées par un rôle.
- **Justification :** Couvre exactement le cas B validé (parcelles, activités, observations, campagnes) et le diagnostic validé par D-12.
- **Conséquences :** Permission (scope = personal) : 9 lignes de référentiel ; RolePermission interdit la portée personal.
- **Risques :** Aucun.
- **Réserves :** Aucune

### D-12 — Diagnostic IA pour le producteur indépendant

- **Catégorie :** C — Arbitrage stratégique indispensable
- **Origine :** v1.2
- **Statut :** Arbitrage validé (fondateur, v2.1)
- **Problème :** Le diagnostic exige la validation d'un agronome affecté à une organisation ; un producteur indépendant n'en a pas.
- **Décision :** Diagnostic IA ouvert aux producteurs indépendants dans le MVP, pour les cinq cultures prioritaires, avec consentement explicite du producteur à chaque demande (AIAnalysisJob.consent_given_by, consent_given_at, consent_text_version). Le consentement ouvre à l'équipe agronomique PEST AI la lecture de cette observation et de ses fichiers, via la file de revue, de façon journalisée. Validation obligatoire par un agronome PEST AI (AgronomistAssignment active sur l'organisation pest_ai) ; agronome responsable, modèle, version, confiance et historique des revues conservés. Un résultat non validé n'est jamais présenté comme un diagnostic confirmé.
- **Justification :** Préserve la règle de validation agronomique obligatoire et la séparation des espaces ; décision qui engage les ressources agronomiques et le modèle économique.
- **Conséquences :** AIAnalysisJob, Diagnostic, DiagnosticEvidence et DiagnosticReview passent au mixin SPACE. AIAnalysisJob : champs de consentement + CHECK. Diagnostic : assigned_agronomist + CHECK confirmé ⇒ revue existante. Permissions personal.diagnostics.request et personal.diagnostics.view. AuditLog diagnostic_consent. Organisation PEST AI (pest_ai) et affectations de ses agronomes à créer au démarrage.
- **Risques :** Charge de revue de l'équipe agronomique PEST AI à dimensionner ; recommandations pour les indépendants non couvertes par cette décision (voir réserves).
- **Réserves :** Arbitrage stratégique validé. Réserve opérationnelle : dimensionnement de l'équipe agronomique PEST AI ; les recommandations pour les producteurs indépendants ne sont pas couvertes par D-12 et restent réservées aux espaces d'organisation.

### D-13 — Partage de l'historique personnel avec une organisation

- **Catégorie :** B — Recommandation soumise au fondateur
- **Origine :** v1.2
- **Statut :** Validée avec réserves (fondateur, v2.1)
- **Problème :** Quand un indépendant rejoint une coopérative, son historique personnel doit-il être visible par elle ?
- **Décision :** MVP : aucun transfert ni partage ; les deux espaces coexistent. Un partage futur passera par un consentement explicite, révocable et tracé (hors MVP, signalé).
- **Justification :** Respecte la séparation des droits ; évite une fonctionnalité de consentement complexe au lancement.
- **Conséquences :** Aucune table au MVP. Point d'extension : future entité de consentement de partage (avec le domaine SFA).
- **Risques :** La coopérative ne voit pas l'historique antérieur du producteur.
- **Réserves :** Aucun transfert automatique ; toute consultation ou transmission future respectera les autorisations et règles de confidentialité (réserve du fondateur).

### D-14 — Inscription autonome et vérification

- **Catégorie :** A — Décision technique finalisée
- **Origine :** v1.2
- **Statut :** Validée (fondateur, v2.1)
- **Problème :** Un producteur indépendant crée seul son compte : risques de faux comptes et de fausses parcelles.
- **Décision :** Vérification du téléphone par OTP SMS obligatoire avant toute écriture (User.phone_verified_at). Codes OTP stockés dans Redis avec expiration (pas de table), limites de tentatives et de fréquence. Parcelles self_registered en statut pending_validation puis active après contrôles géométriques ; chevauchements signalés, jamais d'accès à la parcelle existante.
- **Justification :** Protège la plateforme sans exiger de vérification humaine pour chaque inscription.
- **Conséquences :** User.phone_verified_at (existant). Notifications SMS critiques (D-26). Aucun nouveau modèle.
- **Risques :** Coût SMS ; numéros partagés au sein d'une famille.
- **Réserves :** Aucune

### D-15 — Personnalisation des rôles

- **Catégorie :** A — Décision technique finalisée
- **Origine :** v1.1 n°10
- **Statut :** Validée (fondateur, v2.1)
- **Problème :** Les organisations peuvent-elles modifier les rôles ?
- **Décision :** Non au MVP : les 7 rôles validés sont des rôles système non modifiables ; seule leur attribution est gérée par les organisations.
- **Justification :** Garantit une matrice de permissions maîtrisée et testable.
- **Conséquences :** Role.is_system = True ; aucune interface de création de rôle.
- **Risques :** Besoin futur de rôles sur mesure : extension possible sans refonte.
- **Réserves :** Aucune

### D-16 — Unités de culture

- **Catégorie :** A — Décision technique finalisée
- **Origine :** v1.1 n°11
- **Statut :** Validée (fondateur, v2.1)
- **Problème :** Contour obligatoire des unités et tolérance d'inclusion.
- **Décision :** Géométrie facultative au MVP (unités déclarées par leur code et leur surface). Si présente : incluse dans la géométrie courante de la parcelle avec une tolérance de 1 m, sinon signalée (flagged).
- **Justification :** Les relevés GPS de sous-parcelles sont coûteux ; l'unité reste utile pour les cycles et diagnostics sans contour.
- **Conséquences :** CultivationUnit inchangé ; contrôle ST_Within(ST_Buffer(unit, -1 m)) en tâche Celery.
- **Risques :** Surfaces d'unités déclaratives moins fiables.
- **Réserves :** Aucune

### D-17 — Cycles concurrents

- **Catégorie :** A — Décision technique finalisée
- **Origine :** v1.1 n°12
- **Statut :** Validée (fondateur, v2.1)
- **Problème :** Deux cycles peuvent-ils se chevaucher sur la même unité ou parcelle ?
- **Décision :** Autorisé (cultures associées) mais signalé à l'organisation ou au producteur ; aucun blocage.
- **Justification :** Les associations de cultures sont courantes ; un blocage produirait de fausses erreurs.
- **Conséquences :** Contrôle applicatif, sans contrainte d'exclusion en base.
- **Risques :** Doubles saisies non détectées automatiquement : le signalement les rend visibles.
- **Réserves :** Aucune

### D-18 — Saisons agricoles

- **Catégorie :** A — Décision technique finalisée
- **Origine :** v1.1 n°13
- **Statut :** Validée (fondateur, v2.1)
- **Problème :** Valeurs de AgriculturalCampaign.season_type.
- **Décision :** rainy (hivernage), cold_dry (contre-saison froide), hot_dry (contre-saison chaude), other. Libellés à faire relire par l'agronome.
- **Justification :** Correspond au calendrier agricole sénégalais ; other couvre les cas particuliers.
- **Conséquences :** AgriculturalCampaign.season_type (inchangé).
- **Risques :** Dates de saison variables selon les zones : portées par start_date / end_date.
- **Réserves :** Aucune

### D-19 — Seuils géométriques

- **Catégorie :** A — Décision technique finalisée
- **Origine :** v1.1 n°14
- **Statut :** Validée (fondateur, v2.1)
- **Problème :** Valeurs des contrôles de géométrie.
- **Décision :** Valeurs de départ paramétrables (settings) : surface < 50 m² ou > 50 ha → flagged ; précision GPS > 10 m → flagged ; chevauchement > 5 % de la surface → flagged ; auto-intersection, polygone non fermé, SRID ≠ 4326 → rejected. Ajustables après le pilote.
- **Justification :** Seuils prudents qui signalent sans bloquer le terrain (TAS §12.9).
- **Conséquences :** ParcelGeometry.validation_report ; paramètres dans la configuration Django.
- **Risques :** Faux positifs sur petits maraîchages des Niayes : seuil minimal ajustable.
- **Réserves :** Aucune

### D-20 — Conflits de synchronisation non sensibles

- **Catégorie :** A — Décision technique finalisée
- **Origine :** v1.1 n°15
- **Statut :** Validée (fondateur, v2.1)
- **Problème :** Règle pour les modifications concurrentes de champs non sensibles.
- **Décision :** Fusion champ par champ si les champs modifiés sont disjoints ; si un même champ a changé des deux côtés, conflit ouvert. Données sensibles : toujours conflit, jamais d'écrasement (règle validée).
- **Justification :** Réduit les conflits inutiles sans perte silencieuse.
- **Conséquences :** SyncConflict inchangé ; liste des champs sensibles déclarée par modèle dans core.
- **Risques :** Fusion inattendue sur un texte libre : limitée aux brouillons du même auteur.
- **Réserves :** Aucune

### D-21 — Visite hors mission

- **Catégorie :** A — Décision technique finalisée
- **Origine :** v1.1 n°16
- **Statut :** Validée (fondateur, v2.1)
- **Problème :** Une visite peut-elle exister sans mission ?
- **Décision :** Oui : FieldVisit.mission facultatif (visite spontanée d'un agent).
- **Justification :** Reflète la pratique terrain ; la mission reste l'outil de planification.
- **Conséquences :** Aucun changement.
- **Risques :** Indicateurs de réalisation des missions à calculer sur les seules visites liées.
- **Réserves :** Aucune

### D-22 — Observation du producteur

- **Catégorie :** A — Décision technique finalisée
- **Origine :** v1.1 n°17
- **Statut :** Validée (fondateur, v2.1)
- **Problème :** Un producteur peut-il déclarer une observation sans visite ?
- **Décision :** Oui : dans l'espace d'une organisation (source = producer, visit NULL) et dans son espace personnel (personal_producer, visit NULL obligatoire).
- **Justification :** Indispensable au cas B validé et utile au cas A.
- **Conséquences :** Observation : CHECK personal_producer_id IS NULL OR visit_id IS NULL (v1.2).
- **Risques :** Qualité variable des observations déclaratives : distinguées par source.
- **Réserves :** Aucune

### D-23 — Catalogue des produits agricoles

- **Catégorie :** A — Décision technique finalisée
- **Origine :** v1.1 n°18
- **Statut :** Validée (fondateur, v2.1)
- **Problème :** Référentiel produit au MVP ou texte libre ?
- **Décision :** Respect de la décision AUD §2.7 : AgriculturalProduct = référentiel canonique (MVP), ProductRecommendation = lien recommandation ↔ produit (MVP), SupplierProduct = offre commerciale d'un fournisseur (concept conservé, distinct, reporté avec la gestion avancée des fournisseurs). Aucune fusion. AgriculturalOperation peut référencer un produit ou un texte libre.
- **Justification :** Respecte la décision validée et le report de la gestion avancée des fournisseurs, sans dupliquer le catalogue.
- **Conséquences :** catalog : AgriculturalProduct ; recommendations : ProductRecommendation. SupplierProduct et Supplier : non créés au MVP, signalés comme point d'extension.
- **Risques :** Saisie du référentiel initial (intrants homologués) à prévoir.
- **Réserves :** Aucune

### D-24 — Référentiel phytosanitaire

- **Catégorie :** B — Recommandation soumise au fondateur
- **Origine :** v1.1 n°19
- **Statut :** Validée avec réserves (fondateur, v2.1)
- **Problème :** Contenu initial de PlantHealthIssue pour les 5 cultures.
- **Décision :** Structure retenue (code, nom, type, cultures) avec statut de validation (draft, validated, retired). Contenu encadré et validé par le responsable agronomique avant l'étape 9, aligné sur les label_map. Les produits (AgriculturalProduct), usages et recommandations ne sont jamais considérés comme approuvés automatiquement : seuls les éléments validated sont utilisables.
- **Justification :** Garantit que chaque prédiction pointe vers un problème validé agronomiquement.
- **Conséquences :** PlantHealthIssue et AgriculturalProduct : validation_status, validated_by, validated_at + CHECK. Contrôle applicatif : label_map et ProductRecommendation n'acceptent que des éléments validated.
- **Risques :** Écart entre classes du modèle IA et référentiel : contrôle automatique du label_map.
- **Réserves :** Rien n'est approuvé automatiquement ; validation par le responsable agronomique (réserve du fondateur).

### D-25 — Fournisseur IA externe

- **Catégorie :** C — Arbitrage stratégique indispensable
- **Origine :** v1.1 n°20
- **Statut :** Arbitrage validé (fondateur, v2.1)
- **Problème :** Le TAS prévoit des services IA externes (OpenAI cité). Quelles données peuvent quitter la plateforme ?
- **Décision :** Modèles internes PEST AI privilégiés pour le MVP. Aucune donnée personnelle ni localisation précise transmise à un fournisseur externe. Si un service externe devient techniquement indispensable : données strictement nécessaires, images nettoyées de leurs métadonnées EXIF et GPS, fournisseur, modèle, version et traitements tracés, garanties de confidentialité et de sécurité documentées avant l'intégration (AIModel.data_protection_assessment). Ce n'est pas une interdiction définitive d'intégration externe.
- **Justification :** Décision de confidentialité et de souveraineté des données, avec impact sur les coûts.
- **Conséquences :** AIModel.provider, provider_name, data_protection_assessment (+ CHECK) ; nettoyage des métadonnées avant envoi ; AuditLog external_ai_call.
- **Risques :** Performance d'un modèle interne limitée au lancement.
- **Réserves :** Arbitrage stratégique validé ; pas d'interdiction définitive d'intégration externe.

### D-26 — Notifications SMS critiques

- **Catégorie :** A — Décision technique finalisée
- **Origine :** v1.1 n°21
- **Statut :** Validée (fondateur, v2.1)
- **Problème :** Quelles notifications justifient un SMS (coût) ?
- **Décision :** SMS réservés à : OTP et sécurité du compte (vérification, réinitialisation, appareil révoqué) ; recommandation de traitement validée de priorité haute ; mission assignée pour le jour même à un agent sans push actif. Tout le reste : in_app et push. Fournisseur SMS : choix d'implémentation derrière un connecteur unique.
- **Justification :** Maîtrise le coût tout en garantissant les messages qui ne doivent pas être manqués.
- **Conséquences :** Notification.priority = critical ; NotificationDelivery.channel = sms seulement si critical (contrôle applicatif).
- **Risques :** Producteurs sans smartphone : le SMS reste le seul canal pour les recommandations urgentes.
- **Réserves :** Aucune

### D-27 — Durées de conservation

- **Catégorie :** B — Recommandation soumise au fondateur
- **Origine :** v1.1 n°22
- **Statut :** Validée avec réserves (fondateur, v2.1)
- **Problème :** Fixer la conservation des données techniques et de traçabilité.
- **Décision :** Politique de conservation de référence, PROVISOIRE jusqu'à confirmation juridique avant le pilote : SyncOperation.payload 90 jours (métadonnées conservées) ; ChangeLogEntry 90 jours (au-delà : resynchronisation complète) ; IdempotencyKey 7 jours ; Notification 12 mois ; SyncSession 12 mois ; AuditLog 5 ans ; données métier : archivage logique sans purge au MVP. Purges par tâches Celery tracées.
- **Justification :** Limite le volume sans perdre la traçabilité métier ni l'audit.
- **Conséquences :** Tâches de purge planifiées ; aucune table nouvelle.
- **Risques :** Durées légales applicables à confirmer avec un juriste (loi n° 2008-12).
- **Réserves :** Durées PROVISOIRES : non présentées comme conformes à la réglementation tant que la vérification juridique n'est pas faite (avant le pilote).

### D-28 — Doublons de producteurs

- **Catégorie :** A — Décision technique finalisée
- **Origine :** v1.1 n°23
- **Statut :** Validée (fondateur, v2.1)
- **Problème :** Un même producteur peut être enregistré par plusieurs organisations.
- **Décision :** MVP : détection à la création (nom + téléphone + localité) avec avertissement et proposition de rattacher la fiche existante ; pas d'outil de fusion. Fusion assistée hors MVP, réservée à super_admin, sans suppression (signalée).
- **Justification :** Évite la majorité des doublons à la source sans outil complexe.
- **Conséquences :** Index (last_name, first_name), ProducerContact.value ; service de détection dans actors.
- **Risques :** Doublons résiduels jusqu'à l'outil de fusion.
- **Réserves :** Aucune

### D-29 — Division et fusion de parcelles

- **Catégorie :** A — Décision technique finalisée
- **Origine :** v1.1 n°24
- **Statut :** Validée (fondateur, v2.1)
- **Problème :** Que devient l'AgroID quand une parcelle est divisée ou fusionnée ?
- **Décision :** Hors MVP (signalé). Au MVP, une parcelle peut être retirée (status = retired) et une nouvelle créée ; l'AgroID retiré n'est jamais réutilisé. Une table ParcelLineage reliera plus tard les parcelles d'origine et issues.
- **Justification :** Respecte la permanence de l'AgroID sans anticiper une fonctionnalité rare au lancement.
- **Conséquences :** Parcel.status = retired (existant).
- **Risques :** Historique de filiation non saisi au MVP.
- **Réserves :** Aucune

## 5. Précisions techniques v2.2 (architecte)

**Statut :** Précision technique — incluse dans l'approbation finale ; ne crée ni ne modifie aucune décision métier.

| ID | Sujet | Applique | Solution | Justification | Conséquences |
|---|---|---|---|---|---|
| T-01 | Clé d'espace et clés étrangères composites | Applique F-06, F-17 et D-12 (isolation des espaces) | Les entités SPACE portent space_key, colonne générée et stockée ('org:<uuid>' ou 'personal:<uuid>'). Les objets cibles déclarent UNIQUE (id, space_key) ; les objets qui les référencent déclarent une FK composite (x_id, space_key). PostgreSQL refuse ainsi tout mélange d'espaces : un travail IA, une preuve ou un rattachement ne peut utiliser qu'une observation ou un fichier de son propre espace. Le même mécanisme couvre les 15 relations entre entités SPACE (campagnes, cycles, opérations, récoltes, observations, fichiers, chaîne de diagnostic). La table ai_analysis_job_inputs devient une table de liaison explicite portant space_key (pas une nouvelle entité). | Garantie en base, indépendante du code applicatif ; MATCH SIMPLE ignore les FK facultatives non renseignées. Django 5.2 : GeneratedField(db_persist=True) ; FK composites ajoutées en SQL dans la migration (RunSQL), car Django ne les déclare pas nativement ; les ForeignKey simples restent pour l'ORM. | Colonne générée sur les 12 tables SPACE, UNIQUE (id, space_key) sur 6 tables cibles ; FK composites à maintenir dans les migrations. |
| T-02 | Intégrité de Diagnostic.current_review | Applique F-11 et D-12 | DiagnosticReview déclare UNIQUE (id, diagnostic_id). Diagnostic déclare la FK composite (current_review_id, id) → DiagnosticReview(id, diagnostic_id), DEFERRABLE INITIALLY DEFERRED (création revue + mise à jour du diagnostic dans une même transaction). CHECK (current_review_id IS NULL) = (review_status = 'pending_review'). Un trigger de contrainte différé vérifie que current_review est la revue la plus récente et que review_status et final_issue en découlent. DiagnosticReview est protégée par un trigger append-only. | Rend impossible qu'un diagnostic A référence une revue du diagnostic B, et impossible un statut validé sans revue réelle. | Mise à jour de current_review réservée au service de revue. |
| T-03 | Consentement rattaché au bon compte | Applique D-12 | Producer déclare UNIQUE (id, user_id) ; AIAnalysisJob déclare la FK composite (personal_producer_id, consent_given_by_id) → Producer(id, user_id) et CHECK requested_by = consent_given_by dans l'espace personnel. La lecture de l'observation et des fichiers par l'agronome PEST AI est journalisée (AuditLog diagnostic_review_access). | Le consentement ne peut provenir que du compte lié au producteur dont l'espace est analysé. | Aucun consentement délégué au MVP. |
| T-04 | Triggers de contrôle métier | Applique F-11, D-12, D-24 | Règles contrôlées à l'insertion ET à la modification (BEFORE INSERT OR UPDATE) : culture parmi les cinq et supportée par la version du modèle (AIAnalysisJob) ; agronome affecté habilité (Diagnostic.assigned_agronomist, y compris réaffectation) ; même organisation pour un rattachement à une mission, visite ou recommandation (FileAttachment). Protections d'immutabilité (BEFORE UPDATE) : espace des 12 tables SPACE ; observation, culture, demandeur et consentement d'un travail IA ; images analysées figées au lancement ; champs IA, observation, parcelle et culture d'un diagnostic ; fichier et cible d'un rattachement. Append-only (BEFORE UPDATE OR DELETE) : DiagnosticReview, DiagnosticEvidence ; le reviewer n'est contrôlé qu'à l'insertion car toute modification est refusée. Diagnostic IA : culture = celle de l'analyse. | Les règles critiques ne reposent pas sur le seul contrôle applicatif. | Aucune modification ultérieure ne peut contourner les règles d'espace, de culture, d'affectation agronomique ou de rattachement organisationnel. Les triggers dépendant de dates d'affectation contrôlent l'état au moment de l'écriture (non rétroactif, voulu). |

## 6. Réserves restant ouvertes

Aucune ne remet en cause une décision. Les réserves juridiques doivent être levées avant le pilote ; aucune durée ni aucun traitement ne doit être présenté comme conforme à la réglementation avant cette vérification.

| Réserve | Type | Action attendue | Échéance |
|---|---|---|---|
| Conformité de la collecte et du traitement des données personnelles (loi sénégalaise n° 2008-12, déclarations éventuelles) | Juridique | Avis juridique | Avant pilote |
| Durées de conservation (D-27) : provisoires | Juridique | Confirmation juridique | Avant pilote |
| Textes de consentement (diagnostic D-12, SMS, lien de parcelle) et versionnement | Juridique | Rédaction et validation | Avant étape 9 |
| Contrat et garanties d'un éventuel fournisseur IA externe (D-25) | Juridique | Évaluation avant toute intégration | Si un service externe est envisagé |
| Seuils géométriques (D-19) à ajuster après le pilote | Technique | Mesure sur données réelles | Après pilote |
| Seuil de masquage des petits effectifs dans les indicateurs agrégés (D-04) : paramétrable, valeur non décidée | Technique | Confirmer la valeur (proposition technique : 5, à valider) | Avant étape 10 |
| Alignement label_map des modèles ↔ référentiel PlantHealthIssue validé (D-24) | Technique | Contrôle automatique au déploiement d'un modèle | Avant étape 9 |
| Performance des requêtes inter-organisations (programmes detailed, managers scoped) | Technique | Tests de charge ciblés | Avant pilote |
| Organisation PEST AI (pest_ai) et affectations de ses agronomes à créer au démarrage | Opérationnel | Données initiales | Avant étape 9 |
| Dimensionnement de l'équipe agronomique PEST AI pour la file de revue des indépendants (D-12) | Opérationnel | Plan de charge | Avant pilote |
| Recommandations pour les producteurs indépendants : non couvertes par D-12 | Opérationnel | Décision future si besoin ; le modèle reste extensible | Après MVP |
| Libellés des saisons et contenu des référentiels (D-18, D-24) à relire par le responsable agronomique | Opérationnel | Relecture | Avant étape 7 |
| Compte de connexion d'un producteur non remplaçable tant que des consentements D-12 y renvoient (effet de la FK composite) : procédure de remplacement de compte à définir si le besoin existe | Opérationnel | Définir la procédure (nouveau consentement, sans réécriture de l'historique) | Avant pilote |
| Contraintes composites et triggers de la v2.2 : à écrire en SQL dans les migrations (Django 5.2 ne déclare pas de FK composite) et à couvrir par les tests d'intégrité | Technique | Implémentation et tests (Final Integrity Audit §5) | Étapes 7 à 10 |
| Documents du dépôt (TAS §6, DM §15, RM) antérieurs aux arbitrages | Documentaire | Mise à jour du dépôt avec ce document (non modifiés ici) | Avant étape 1 |

---

*Aucun code, aucune migration et aucune modification du dépôt GitHub n'ont été réalisés.*
