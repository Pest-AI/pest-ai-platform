# PEST AI OS — Final Integrity Audit v1.1

**Date :** 20 novembre 2026  
**Objet :** audit technique ciblé de la conception Database Design MVP v2.1 et corrections intégrées en v2.2  
**Révision 1.1 :** complément d'audit des triggers (insertion et modification) demandé après la revue de la v2.2 — section 2.7  
**Documents produits :** `PEST-AI-OS-Database-Design-MVP-Scope-v2.2.pdf`, `PEST-AI-OS-Decision-Register-v2.1.md`, `PEST-AI-OS-ERD-v2.2.zip`  
**Sources examinées :** Database Design v2.1, Decision Register v2.0, archive ERD v2.1, dépôt `Pest-AI/pest-ai-platform` (branche main, commit 6b3a959, inchangé depuis l'analyse initiale)

> Aucune décision métier n'a été modifiée. Aucun code, aucune migration, aucune modification du dépôt GitHub. Les corrections sont des précisions techniques (T-01 à T-04) qui appliquent des décisions déjà validées.

## 1. Synthèse

| Point audité | Constat v2.1 | Correction v2.2 | État |
|---|---|---|---|
| Isolation des fichiers utilisés par l'IA | Non garantie en base : la table des images d'un travail IA, DiagnosticEvidence.file et FileAttachment pouvaient référencer un fichier ou une observation d'un autre espace ; le seul contrôle (FileAttachment) était applicatif et ne couvrait pas l'espace personnel | Clé d'espace `space_key` + FK composites (T-01) | Corrigé |
| `Diagnostic.current_review` | Pouvait référencer la revue d'un autre diagnostic ; statuts `rejected` / `needs_more_info` possibles sans revue | FK composite différée + CHECK + trigger de contrainte (T-02) | Corrigé |
| Consentement D-12 | Champs et CHECK présents, mais consentement non lié au compte du producteur concerné ; consultation de l'agronome non distinguée dans le journal | FK composite vers Producer(id, user_id), CHECK demandeur = consentant, action d'audit dédiée (T-03) | Corrigé |
| Règles « 5 cultures », agronome habilité, append-only des revues | Contrôle applicatif seulement | Triggers PostgreSQL documentés (T-04) | Corrigé |
| D-04 confidentialité des programmes | Correctement représenté ; seuil de petits effectifs présenté avec une valeur indicative | Seuil paramétrable, valeur explicitement non décidée ; AgroID, géométrie et localisation explicitement exclus du niveau aggregated | Précisé |
| Triggers contrôlés seulement à l'insertion (révision 1.1) | Culture et version de modèle d'une analyse, agronome affecté, cible d'un rattachement modifiables par UPDATE ; consentement, images analysées, contexte d'un diagnostic et preuves non protégés | BEFORE INSERT OR UPDATE et protections d'immutabilité | Corrigé |
| Cohérence globale (17 points de la mission) | — | Vérification croisée automatique | Conforme |

## 2. Contrôles effectués

### 2.1 Isolation des fichiers utilisés par l'IA

Relations examinées : `AIAnalysisJob`, `FileAsset`, `FileAttachment`, `Observation`, `Producer`, `Organization`.

**Problèmes constatés (v2.1)**

1. `AIAnalysisJob.input_files` (table `ai_analysis_job_inputs`) : aucune contrainte entre l'espace du travail et celui des fichiers analysés.
2. `AIAnalysisJob.observation`, `Diagnostic.observation`, `Diagnostic.analysis_job` : aucune contrainte d'espace en base.
3. `DiagnosticEvidence.file` et `.diagnostic` : idem.
4. `FileAttachment` : CHECK « file.organization_id = organization_id (contrôle applicatif) » — impossible en CHECK PostgreSQL (référence à une autre table) et muet pour l'espace personnel.
5. `FileAttachment` en espace personnel pouvait viser une mission, une visite ou une recommandation (objets d'organisation uniquement).
6. `FileAsset.storage_key` préfixée par l'organisation, inadaptée à l'espace personnel.

**Correction (T-01)** — la plus robuste compatible avec Django 5.2 et PostgreSQL 16 :

- Mixin SPACE : colonne `space_key varchar(45) GENERATED ALWAYS AS (CASE WHEN organization_id IS NOT NULL THEN 'org:' || organization_id::text ELSE 'personal:' || personal_producer_id::text END) STORED` (Django : `GeneratedField(db_persist=True)`). Préfixe explicite : aucune collision possible entre un identifiant d'organisation et un identifiant de producteur.
- Tables cibles : `UNIQUE (id, space_key)`.
- Tables qui référencent : FK composite `(x_id, space_key) REFERENCES cible(id, space_key)`. En `MATCH SIMPLE` (défaut PostgreSQL), une FK facultative non renseignée n'est pas contrôlée, ce qui est le comportement attendu.
- Table `ai_analysis_job_inputs` rendue explicite (through) avec `space_key` et deux FK composites. Ce n'est pas une nouvelle entité métier : la table existait déjà comme table de liaison implicite.
- `FileAttachment` : CHECK `personal_producer_id IS NULL OR num_nonnulls(mission_id, visit_id, recommendation_id) = 0` ; même organization_id pour les cibles d'organisation contrôlé par trigger BEFORE INSERT.
- Pourquoi pas un trigger seul : une FK composite est déclarative, vérifiée par le moteur pour toute écriture (ORM, SQL brut, synchronisation, script d'administration) et ne peut pas être contournée par un oubli applicatif.
- Mise en œuvre Django 5.2 : `ForeignKey` simples conservées pour l'ORM ; `UniqueConstraint(fields=["id", "space_key"])` dans Meta ; FK composites ajoutées par `RunSQL` dans les migrations (Django ne les déclare pas nativement).

Extension : la même règle couvre les 15 relations entre entités SPACE (dont campagnes, cycles, opérations, récoltes), pour que l'isolation des deux espaces soit uniforme :

| Entité | Champ | Cible |
|---|---|---|
| CropCycle | campaign | AgriculturalCampaign |
| AgriculturalOperation | crop_cycle | CropCycle |
| HarvestRecord | crop_cycle | CropCycle |
| Observation | crop_cycle | CropCycle |
| FileAttachment | file | FileAsset |
| FileAttachment | observation | Observation |
| FileAttachment | diagnostic | Diagnostic |
| AIAnalysisJob | observation | Observation |
| Diagnostic | observation | Observation |
| Diagnostic | crop_cycle | CropCycle |
| Diagnostic | analysis_job | AIAnalysisJob |
| Diagnostic | current_review | DiagnosticReview |
| DiagnosticEvidence | diagnostic | Diagnostic |
| DiagnosticEvidence | file | FileAsset |
| DiagnosticReview | diagnostic | Diagnostic |

### 2.2 Intégrité de `Diagnostic.current_review`

**Problèmes constatés (v2.1)** : la FK simple `current_review → DiagnosticReview` acceptait la revue d'un autre diagnostic ; le CHECK ne couvrait que `confirmed` / `corrected` ; la cohérence statut ↔ revue reposait sur le code applicatif.

**Correction (T-02)**

- `DiagnosticReview` : `UNIQUE (id, diagnostic_id)`.
- `Diagnostic` : `FOREIGN KEY (current_review_id, id) REFERENCES diagnostic_review (id, diagnostic_id) DEFERRABLE INITIALLY DEFERRED` — la revue courante appartient obligatoirement au diagnostic. Différée car la revue et la mise à jour du diagnostic sont écrites dans la même transaction (dépendance circulaire).
- `CHECK ((current_review_id IS NULL) = (review_status = 'pending_review'))` — tout statut issu d'une revue (`confirmed`, `corrected`, `rejected`, `needs_more_info`) exige une revue enregistrée ; `pending_review` n'en a aucune.
- `CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED` : `current_review` est la revue la plus récente du diagnostic ; `review_status` = sa décision ; `final_issue` = `predicted_issue` si confirmed, `corrected_issue` si corrected.
- `DiagnosticReview` : trigger BEFORE UPDATE OR DELETE (append-only) — l'historique est conservé.
- Écriture réservée au service de revue (une transaction : insertion de la revue, puis mise à jour du diagnostic).

### 2.3 Consentement D-12 (parcours complet)

| Exigence non négociable | Représentation v2.2 | État |
|---|---|---|
| L'indépendant peut demander un diagnostic au MVP | Chaîne diagnostic en SPACE ; permission `personal.diagnostics.request` | OK |
| Cinq cultures prioritaires uniquement | `Crop.is_ai_supported` ; trigger BEFORE INSERT sur AIAnalysisJob (culture supportée par la version du modèle) | OK (renforcé) |
| Consentement explicite à chaque demande | Champs portés par chaque AIAnalysisJob ; CHECK obligatoire en espace personnel | OK |
| Rattaché au bon utilisateur et au bon producteur | FK composite `(personal_producer_id, consent_given_by_id) → Producer(id, user_id)` ; CHECK `requested_by_id = consent_given_by_id` | Corrigé |
| Date et version du texte conservées | `consent_given_at`, `consent_text_version` (NOT NULL en espace personnel) | OK |
| Consultation par l'équipe agronomique PEST AI | Lecture de l'observation et des fichiers analysés via la file de revue uniquement | OK |
| Consultation journalisée | AuditLog `diagnostic_review_access` à chaque consultation ; `diagnostic_consent` à la demande | Corrigé |
| Validation d'un agronome PEST AI obligatoire | `assigned_agronomist` ; trigger : affectation active sur l'organisation `pest_ai` ; trigger sur le reviewer | OK (renforcé) |
| Résultat non validé jamais présenté comme confirmé | CHECK `is_visible_to_producer` ⇒ confirmed/corrected ; CHECK revue ⇔ statut ; FK composite current_review | OK (renforcé) |

### 2.4 D-04 — Confidentialité des programmes

| Règle | Représentation | État |
|---|---|---|
| aggregated par défaut : indicateurs, effectifs, surfaces, résultats | `ProgramOrganization.data_sharing_level` (défaut) ; endpoints d'indicateurs distincts des endpoints de liste | OK |
| Aucune liste nominative, aucun AgroID, aucune géométrie ni localisation précise, aucune donnée individuelle | Note du champ et section 9.9 ; ProgramBeneficiary / ProgramParcel invisibles pour la porteuse en aggregated (404) | OK (précisé) |
| detailed : autorisation explicite, lecture seule, limitée au programme | `sharing_decided_by`, `sharing_decided_at` ; managers scoped | OK |
| Journalisation obligatoire | AuditLog `program_detailed_access` | OK |
| Petits effectifs | Seuil paramétrable (configuration plateforme, pas de table) ; **valeur non décidée** — 5 n'est qu'une proposition technique à confirmer | Précisé |

### 2.5 Audit croisé de cohérence (17 points)

| # | Élément | Résultat |
|---|---|---|
| 1 | Entités | 63 — inchangé |
| 2 | Domaines métier | 11 — inchangé |
| 3 | Applications Django | 17, graphe sans cycle — inchangé |
| 4 | Relations et cardinalités | 362 relations ; cardinalités cohérentes avec les contraintes NOT NULL / on_delete |
| 5 | Clés étrangères et contraintes | Toutes les FK pointent vers une entité existante ; FK composites v2.2 ajoutées sans nouvelle relation |
| 6 | Deux espaces | 12 entités SPACE ; CHECK un seul espace ; FK composites sur toutes les relations entre elles |
| 7 | Sept rôles | Exactement 7, aucun ajout |
| 8 | Permissions et isolation | Portées organization / platform / personal ; contexte X-Workspace ; 404 hors périmètre |
| 9 | Producteurs indépendants et rattachés | Cas A / cas B ; ProducerParcelAccess ; aucun accès déduit |
| 10 | Parcelles, propriétaires, exploitants, AgroID | Inchangés ; AgroID permanent et non réutilisable |
| 11 | Campagnes, cycles, CultivationUnit | Inchangés ; FK composites d'espace ajoutées |
| 12 | Missions, visites, observations | Inchangés ; observation personnelle sans visite (CHECK) |
| 13 | Fichiers et rattachements | Corrigés (T-01) |
| 14 | Diagnostics IA et validations | Corrigés (T-02, T-03, T-04) |
| 15 | Programmes et partage | Conformes à D-04 |
| 16 | Synchronisation hors ligne | Inchangée ; une opération ne peut écrire que dans l'espace de sa session, désormais aussi garanti par les FK composites |
| 17 | Notifications et journaux d'audit | Inchangés ; action `diagnostic_review_access` ajoutée |

**Diagrammes** : les FK composites renforcent des relations existantes et n'ajoutent aucune arête ; les ERD v2.2 sont régénérés depuis la même source que le dictionnaire et comparés relation par relation (contrôles « ERD par domaine » et « Source Mermaid globale »).

### 2.7 Audit des triggers : insertion et modification (révision 1.1)

Méthode : chaque règle déclarée `BEFORE INSERT` a été réexaminée pour les `UPDATE`. Les FK composites et les CHECK s'appliquent nativement aux deux opérations et ne sont pas concernés.

| Table | Règle | Faille possible par UPDATE | Protection retenue |
|---|---|---|---|
| 12 tables SPACE | Espace fixé à la création | Changer `organization_id` / `personal_producer_id`, donc `space_key` | Trigger commun BEFORE UPDATE : immuables (auparavant énoncé seulement pour les tables TENANT) |
| AIAnalysisJob | Cinq cultures ; culture supportée par la version | `crop_id` ou `model_version_id` modifiés après insertion (`model_version_id` est renseigné au lancement, donc par UPDATE) | `BEFORE INSERT OR UPDATE OF crop_id, model_version_id` ; `model_version_id` renseigné une seule fois |
| AIAnalysisJob | Consentement du bon compte, daté, versionné | Réécriture du consentement, du demandeur ou de l'observation | BEFORE UPDATE : `observation_id`, `crop_id`, `requested_by_id`, `idempotency_key`, `consent_*` immuables |
| ai_analysis_job_inputs | Images du même espace | Ajout ou retrait d'images après le lancement | UPDATE refusé ; INSERT / DELETE refusés hors statut `queued` |
| Diagnostic | Agronome habilité (pest_ai en espace personnel) | Réaffectation à un agronome non habilité (le trigger v2.2 ne précisait pas l'opération) | `BEFORE INSERT OR UPDATE OF assigned_agronomist_id` ; réaffectation journalisée |
| Diagnostic | Résultat IA et contexte | Changer observation, parcelle ou culture (seuls les champs IA étaient protégés) | BEFORE UPDATE : `origin`, `observation_id`, `parcel_id`, `crop_id`, `analysis_job_id`, `model_version_id`, `predicted_issue_id`, `confidence`, `alternatives` immuables |
| Diagnostic | Culture IA | Diagnostic IA créé avec une autre culture que celle contrôlée à l'analyse | BEFORE INSERT : `crop_id = analysis_job.crop_id` (puis immuable) |
| Diagnostic | Revue courante cohérente | Modifier statut, revue courante ou résultat final | Trigger de contrainte `AFTER INSERT OR UPDATE OF current_review_id, review_status, final_issue_id`, différé |
| DiagnosticReview | Reviewer habilité | Aucune : toute modification est refusée | Inchangé (append-only) — contrôle à l'insertion suffisant |
| DiagnosticEvidence | Preuves du même espace | Remplacer un fichier de preuve | Append-only : BEFORE UPDATE OR DELETE |
| FileAttachment | Même organisation que la mission / visite / recommandation | Changer de fichier ou de cible après insertion | Fichier et cibles immuables (BEFORE UPDATE) ; contrôle d'organisation BEFORE INSERT OR UPDATE ; changer de cible = archiver et recréer |

**Côté référentiels** : la fin d'une affectation d'agronome, le retrait d'une culture de la liste IA ou la modification d'une version de modèle ne sont pas rétroactifs. Les triggers contrôlent l'état au moment de l'écriture ; l'historique validé reste intact (comportement voulu).

**Effet à noter** : la FK composite du consentement (`ON UPDATE NO ACTION`) empêche de remplacer le compte de connexion d'un producteur tant que des consentements y renvoient. C'est protecteur ; une procédure de remplacement de compte reste à définir si le besoin existe (point opérationnel, pas une décision métier).

**Conclusion** : aucune modification ultérieure ne peut contourner les contraintes d'espace, de culture, d'affectation agronomique ou de rattachement organisationnel.

### 2.6 Résultats des contrôles automatiques : 88 / 88 réussis

| Vérification | Résultat |
|---|---|
| Toutes les clés étrangères pointent vers une entité existante | OK — 359 clés vérifiées |
| Aucun attribut en double dans une entité | OK |
| Chaque entité a une clé primaire (UUID, sauf ChangeLogEntry.seq) | OK — 63 entités |
| Cardinalités : aucune clé obligatoire avec on_delete=SET_NULL | OK |
| CASCADE limité aux lignes dépendantes (liaisons, actions, livraisons) | OK — 12 cas : DiagnosticEvidence.diagnostic, IdempotencyKey.user, MissionAgent.mission, MissionTarget.mission, NotificationDelivery.notification, NotificationPreference.user, ProducerContact.producer, ProductRecommendation.action, ProductRecommendation.recommendation, RecommendationAction.recommendation, RolePermission.permission, RolePermission.role |
| Entités TENANT : organization obligatoire et PROTECT | OK — 10 entités |
| Liens d'accès multi-organisation historisés (date ou statut de fin) | OK — OrganizationMembership, ProducerOrganizationAssignment, ParcelOrganizationLink, ProgramOrganization, AgronomistAssignment, ProgramBeneficiary, ProgramParcel, ProducerParcelAccess |
| Exception plateforme bornée et justifiée | OK |
| ERD par domaine identiques aux clés du dictionnaire | OK — 12 diagrammes comparés relation par relation |
| Source Mermaid globale (annexe A) identique aux clés du dictionnaire | OK — 142 relations |
| Carte des domaines : 11 domaines, total des entités = dictionnaire | OK — 63 entités sur 63 |
| Décisions validées intégrées au modèle | OK — 15 décisions vérifiées |
| Aucune entité de domaine reporté réintroduite | OK — 43 noms d'entités reportées contrôlés |
| Graphe des applications Django sans cycle | OK — 17 applications |
| Types de champs disponibles dans Django 5.2 / GeoDjango | OK |
| Fonctions PostgreSQL 16 requises disponibles | OK — NULLS NOT DISTINCT (PG15+, Django nulls_distinct=False) sur AgronomistAssignment, MissionTarget, ProductRecommendation ; num_nonnulls ; GiST ; geography |
| Géométries en SRID 4326 uniquement | OK |
| Rôles : le dictionnaire (Role.code) liste exactement les 7 rôles validés | OK — super_admin, organization_admin, cooperative_manager, field_agent, agronomist, producer, program_manager |
| Rôles : le tableau 9.2 contient exactement les 7 rôles, dans l'ordre validé | OK — 7 lignes |
| Rôles : super_admin seul rôle de portée plateforme | OK |
| Permissions : portée organisation / plateforme modélisée | OK |
| Super Admin attribué uniquement par PlatformRoleAssignment | OK |
| Plusieurs rôles par utilisateur et par organisation conservés (MembershipRole N:N) | OK — aucun champ role sur User |
| Producteur créable sans organisation (cas B) | OK |
| Mixin SPACE : un seul espace par enregistrement (CHECK) sur chaque entité concernée | OK — 12 entités : AgriculturalCampaign, CropCycle, AgriculturalOperation, HarvestRecord, Observation, FileAsset, FileAttachment, AIAnalysisJob, Diagnostic, DiagnosticEvidence, DiagnosticReview, SyncConflict |
| Accès personnel explicite et historisé (ProducerParcelAccess) | OK |
| Aucun accès déduit de la propriété ou de l'exploitation | OK |
| Portée de permission personal, jamais attribuée par un rôle | OK |
| Rôle producer conditionné à un rattachement actif (cas A) | OK |
| Consentement du producteur pour lier sa parcelle à une organisation | OK |
| Déclarations du producteur distinguées des enregistrements d'organisation | OK |
| Diagramme des deux situations produit | OK |
| Registre : 29 points traités, identifiants uniques | OK — 29 décisions |
| Registre : chaque point a analyse, solution, justification, conséquences et risques | OK |
| Registre : arbitrages stratégiques (C) limités au strict nécessaire | OK — A=20, B=6, C=3 |
| Dictionnaire : chaque renvoi [D-xx] existe dans le registre | OK — 15 décisions référencées dans le dictionnaire |
| Dictionnaire : plus aucune hypothèse « à valider » sans renvoi au registre | OK |
| Programmes : niveau de partage modélisé avec défaut protecteur (D-04) | OK |
| Catalogue : AgriculturalProduct et ProductRecommendation distincts, SupplierProduct non fusionné (reporté) | OK |
| Décisions validées préservées : 7 rôles, SFA et satellite hors MVP, programmes et CultivationUnit inclus | OK |
| D-04 : aggregated sans liste nominative, AgroID, géométrie ni localisation | OK |
| D-04 : seuil de petits effectifs paramétrable et non présenté comme décidé | OK |
| D-04 : detailed sur autorisation explicite et consultations journalisées | OK |
| D-04 : ProgramBeneficiary / ProgramParcel non visibles par la porteuse en aggregated | OK |
| D-04 : visibilité Producer sans accès nominatif via programme en aggregated | OK |
| D-12 : chaîne diagnostic disponible dans l'espace personnel (mixin SPACE) | OK |
| D-12 : consentement explicite obligatoire dans l'espace personnel (CHECK) | OK |
| D-12 : aucun diagnostic confirmé sans validation agronomique (CHECK) | OK |
| D-12 : agronome, modèle, version, confiance et historique tracés | OK |
| D-12 : validation par un agronome PEST AI pour l'espace personnel | OK |
| D-12 : cinq cultures inchangées | OK |
| D-25 : garanties documentées obligatoires pour un fournisseur externe | OK |
| D-24 : référentiels jamais approuvés automatiquement | OK |
| D-13 : aucun transfert automatique de l'historique personnel | OK |
| D-27 : durées de conservation marquées provisoires | OK |
| Catalogue : un produit, plusieurs offres et plusieurs contextes de recommandation | OK |
| Registre : toutes les décisions ont un statut validé | OK — 29 D + 17 F |
| Registre : toutes les réserves des décisions B et C sont renseignées | OK |
| Réserves classées juridique / technique / opérationnel / documentaire | OK |
| Aucun huitième rôle introduit | OK |
| v2.2 : space_key généré présent sur toutes les entités SPACE | OK — 12 entités |
| v2.2 : chaque relation entre entités SPACE est protégée par une FK composite d'espace | OK — 15 relations couvertes |
| v2.2 : chaque cible déclare UNIQUE (id, space_key) | OK — AIAnalysisJob, AgriculturalCampaign, CropCycle, Diagnostic, FileAsset, Observation |
| v2.2 : images d'un travail IA limitées au même espace (table de liaison explicite + FK composites) | OK |
| v2.2 : plus de contrôle d'espace uniquement applicatif sur FileAttachment | OK |
| v2.2 : current_review appartient obligatoirement au diagnostic (FK composite différée) | OK |
| v2.2 : revue courante = revue la plus récente, statut cohérent (trigger de contrainte) | OK |
| v2.2 : DiagnosticReview append-only garanti en base | OK |
| v2.2 : consentement rattaché au compte du producteur concerné | OK |
| v2.2 : consultation par l'agronome PEST AI journalisée | OK |
| v2.2 : cinq cultures contrôlées en base (trigger) | OK |
| v2.2 : précisions techniques non présentées comme décisions du fondateur | OK |
| v2.2 : périmètre inchangé (63 entités, 17 applications, 11 domaines) | OK |
| Triggers : aucune règle contrôlée seulement à l'insertion sur une table modifiable | OK — 12 triggers examinés |
| Triggers : DiagnosticReview append-only, contrôle du reviewer à l'insertion suffisant | OK |
| Triggers : culture et version de modèle contrôlées aussi en UPDATE (AIAnalysisJob) | OK |
| Triggers : consentement et images analysées non modifiables après coup | OK |
| Triggers : réaffectation de l'agronome contrôlée (Diagnostic) | OK |
| Triggers : culture d'un diagnostic IA = culture de l'analyse, immuable | OK |
| Triggers : fichier et cible d'un rattachement immuables (FileAttachment) | OK |
| Triggers : espace immuable sur les 12 tables SPACE | OK |
| Triggers : DiagnosticEvidence append-only | OK |
| PDF : les 7 codes de rôle validés apparaissent dans le document | OK — super_admin ×20, organization_admin ×15, cooperative_manager ×8, field_agent ×24, agronomist ×30, producer ×216, program_manager ×5 |
| PDF : aucun ancien code de rôle hors des notes de révision | OK — 0 occurrence |
| PDF : section 9.2 — 7 rôles présents | OK |
| PDF : dictionnaire (entité Role) — 7 rôles présents | OK |
| PDF : section 9.9 — le niveau aggregated n'expose aucune liste nominative | OK |
| PDF : diagnostic des indépendants documenté (section 12.2) | OK |

## 3. Corrections apportées (fichiers)

| Document | Modification |
|---|---|
| Database Design v2.2 | Note de révision v2.2 (dont complément d'audit des triggers) ; dictionnaire : ligne « Intégrité en base (v2.2) » sur 12 entités ; sections 9.5, 9.9, 12.2 ; nouvelles sections 12.6 et 12.7 ; chapitre 15.5 (T-01 à T-04) ; chapitre 16 |
| Decision Register v2.1 | Section 5 « Précisions techniques » (T-01 à T-04, non métier ; T-04 étendu aux modifications) ; réserve D-04 précisée ; réserve technique sur les migrations ; aucune décision du fondateur ajoutée ou modifiée |
| ERD v2.2 | 19 diagrammes et leurs sources régénérés, identiques au dictionnaire ; le complément d'audit ne crée aucune relation, les diagrammes sont donc inchangés sur le fond |

## 4. Décisions préservées

Sept rôles ; producteur indépendant ou rattaché ; aucun accès automatique aux données d'une organisation ; AgroID permanent, unique, non réutilisable ; propriétaire ≠ exploitant ; SFA et satellite en Phase 2 ; diagnostic limité aux cinq cultures avec validation agronomique ; programmes au MVP ; AgriculturalProduct, SupplierProduct et ProductRecommendation distincts ; historiques conservés ; synchronisation idempotente avec conflits ; stack Python 3.12, Django 5.2 LTS, DRF, PostgreSQL 16 + PostGIS ; durées D-27 provisoires.

## 5. Tests d'intégrité à réaliser pendant le développement

Tests à écrire au niveau base (transactions directes, hors ORM) et au niveau API.

| # | Test | Résultat attendu |
|---|---|---|
| I-01 | Insérer dans `ai_analysis_job_inputs` un fichier personnel pour un travail d'organisation (et l'inverse) | Violation de FK composite |
| I-02 | Idem entre deux organisations différentes | Violation de FK composite |
| I-03 | Créer un AIAnalysisJob sur une observation d'un autre espace | Violation de FK composite |
| I-04 | DiagnosticEvidence ou FileAttachment vers un fichier d'un autre espace | Violation de FK composite |
| I-05 | FileAttachment personnel rattaché à une mission, une visite ou une recommandation | Violation du CHECK |
| I-06 | Rattachement d'organisation à une visite d'une autre organisation | Refus du trigger |
| I-07 | `space_key` : tentative d'écriture directe | Refus (colonne générée) |
| I-08 | Diagnostic A avec `current_review` = revue du diagnostic B | Violation de FK composite au COMMIT |
| I-09 | Diagnostic `confirmed`, `corrected`, `rejected` ou `needs_more_info` sans revue | Violation du CHECK |
| I-10 | `current_review` pointant vers une revue plus ancienne que la dernière | Refus du trigger de contrainte au COMMIT |
| I-11 | `review_status` différent de la décision de la revue courante | Refus du trigger de contrainte |
| I-12 | UPDATE ou DELETE d'une DiagnosticReview | Refus du trigger |
| I-13 | Modification des champs IA d'un Diagnostic | Refus du trigger |
| I-14 | AIAnalysisJob personnel sans consentement, ou avec un consentement d'un autre compte que celui du producteur | Violation du CHECK / de la FK composite |
| I-15 | AIAnalysisJob personnel dont le demandeur n'est pas le consentant | Violation du CHECK |
| I-16 | AIAnalysisJob sur une culture hors des cinq | Refus du trigger |
| I-17 | Revue d'un diagnostic personnel par un agronome sans affectation active `pest_ai` | Refus du trigger |
| I-18 | Consultation par l'agronome PEST AI d'une observation soumise | Ligne AuditLog `diagnostic_review_access` |
| I-19 | Lecture par le producteur d'un diagnostic `pending_review` | Non visible (API) |
| I-20 | Porteuse en aggregated : appel des listes ProgramBeneficiary / ProgramParcel | 404, aucune donnée nominative |
| I-21 | Indicateur agrégé sous le seuil paramétré | Valeur masquée |
| I-22 | Porteuse en detailed : lecture | Lecture seule, limitée au programme, AuditLog `program_detailed_access` |
| I-23 | Synchronisation : opération d'une session personnelle visant un objet d'organisation | Rejet (contexte) et violation de FK composite si contournement |
| I-24 | Rejouer une SyncOperation | Statut duplicate, aucune nouvelle ligne |
| I-25 | UPDATE de `organization_id` ou `personal_producer_id` sur chacune des 12 tables SPACE | Refus du trigger |
| I-26 | UPDATE de `crop_id` d'un AIAnalysisJob vers une culture hors des cinq ; UPDATE de `model_version_id` vers une version qui ne supporte pas la culture ; second changement de `model_version_id` | Refus du trigger |
| I-27 | UPDATE des champs de consentement, de `requested_by_id` ou de `observation_id` d'un AIAnalysisJob | Refus du trigger |
| I-28 | Ajout, suppression ou modification d'une image d'un travail en statut running / succeeded | Refus du trigger |
| I-29 | Réaffectation d'un diagnostic personnel à un agronome sans affectation active pest_ai | Refus du trigger ; réaffectation valide journalisée |
| I-30 | UPDATE de `observation_id`, `parcel_id` ou `crop_id` d'un Diagnostic ; diagnostic IA avec une culture différente de l'analyse | Refus du trigger |
| I-31 | UPDATE de `review_status` sans nouvelle revue | Refus du trigger de contrainte au COMMIT |
| I-32 | UPDATE ou DELETE d'une DiagnosticEvidence | Refus du trigger |
| I-33 | UPDATE de `file_id` ou d'une colonne de cible d'un FileAttachment ; UPDATE de `caption` | Refus ; modification de `caption` acceptée |
| I-34 | Remplacer `Producer.user_id` alors que des consentements y renvoient | Violation de FK (procédure dédiée à définir) |

## 6. Risques résiduels

| Risque | Niveau | Atténuation |
|---|---|---|
| FK composites et triggers écrits en SQL dans les migrations : risque d'oubli ou de divergence avec les modèles Django | Moyen | Tests I-01 à I-17 obligatoires en CI ; contrôle de schéma comparant les contraintes attendues à `pg_constraint` |
| Triggers dépendant de dates d'affectation : contrôlent l'état au moment de l'écriture, pas a posteriori | Faible | Comportement voulu ; la revue reste historisée |
| Ré-identification par indicateurs agrégés tant que le seuil n'est pas fixé | Moyen | Seuil paramétrable obligatoire avant l'étape 10 |
| Contournement de la journalisation des consultations par un accès hors API | Faible | Accès base réservé ; lectures de l'agronome uniquement via la file de revue |
| Charge de l'équipe agronomique PEST AI | Opérationnel | Plan de charge avant pilote |
| Entités TENANT ↔ TENANT : même organization_id contrôlé par service et triggers, sans FK composite | Faible | Hors périmètre de cet audit ; même mécanisme applicable si besoin, sans changement métier |

## 7. Éléments à confirmer

| Élément | Type | Échéance |
|---|---|---|
| Conformité de la collecte et du traitement des données personnelles (loi sénégalaise n° 2008-12, déclarations éventuelles) | Juridique | Avant pilote |
| Durées de conservation (D-27) : provisoires | Juridique | Avant pilote |
| Textes de consentement (diagnostic D-12, SMS, lien de parcelle) et versionnement | Juridique | Avant étape 9 |
| Contrat et garanties d'un éventuel fournisseur IA externe (D-25) | Juridique | Si un service externe est envisagé |
| Organisation PEST AI (pest_ai) et affectations de ses agronomes à créer au démarrage | Opérationnel | Avant étape 9 |
| Dimensionnement de l'équipe agronomique PEST AI pour la file de revue des indépendants (D-12) | Opérationnel | Avant pilote |
| Recommandations pour les producteurs indépendants : non couvertes par D-12 | Opérationnel | Après MVP |
| Libellés des saisons et contenu des référentiels (D-18, D-24) à relire par le responsable agronomique | Opérationnel | Avant étape 7 |
| Compte de connexion d'un producteur non remplaçable tant que des consentements D-12 y renvoient (effet de la FK composite) : procédure de remplacement de compte à définir si le besoin existe | Opérationnel | Avant pilote |

Aucune contradiction nécessitant un nouvel arbitrage stratégique du fondateur n'a été trouvée.

## 8. Conclusion

Les deux problèmes d'intégrité sont corrigés en base de données, le consentement D-12 est cohérent de bout en bout, les règles D-04 sont correctement représentées, les diagrammes correspondent au dictionnaire et toutes les décisions validées sont préservées. La conception v2.2 est prête à être soumise à l'approbation finale du fondateur. Aucun développement ne démarre sans cette approbation explicite.

---

*Aucun code, aucune migration et aucune modification du dépôt GitHub n'ont été réalisés.*
