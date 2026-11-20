# PEST AI OS — Implementation Roadmap

**Version:** 1.0  
**Status:** Draft — Roadmap de référence  
**Project:** PEST AI OS  
**Parent specification:** Technical-Architecture-Specification.md

---

## 1. Objectif du document

Ce document définit la feuille de route d'implémentation de PEST AI OS.

L'objectif est de construire une plateforme agricole intelligente globale, organisée en phases successives, en commençant par un MVP opérationnel et en évoluant progressivement vers un système complet intégrant les données agricoles, l'intelligence artificielle, la géospatialisation, la voix, la traçabilité et les services financiers.

La plateforme doit être conçue globalement dès le départ, mais développée progressivement.

**Principe fondamental :** nous ne construisons pas plusieurs applications indépendantes. Nous construisons un système d'exploitation agricole modulaire dont les capacités sont activées au fil des phases.

## 2. Principes de mise en œuvre

1. **Architecture globale, développement progressif :** les domaines fonctionnels futurs sont anticipés dès la conception.
2. **Priorité au MVP :** développer d'abord les fonctionnalités nécessaires à une première utilisation réelle sur le terrain.
3. **Modularité :** chaque domaine fonctionnel doit pouvoir évoluer sans imposer une refonte générale.
4. **Dépendances maîtrisées :** les fonctionnalités avancées reposent sur des fondations de données fiables.
5. **Validation terrain :** les phases sont validées à partir de scénarios réels d'utilisation.
6. **Sécurité dès le départ :** permissions, séparation des organisations, journalisation et protection des données.
7. **Évolutivité :** les fonctionnalités futures sont préparées architecturalement sans être prématurément développées.

## 3. Vue générale des phases

| Phase | Intitulé | Résultat principal |
|---|---|---|
| 0 | Fondations techniques | Infrastructure et socle applicatif |
| 1 | MVP agricole opérationnel | Gestion des producteurs, parcelles et opérations |
| 2 | Intelligence agricole | Analyses IA et recommandations |
| 3 | Données géospatiales | Satellite, environnement et AgroShield |
| 4 | Intelligence conversationnelle | Fary ASR/TTS et interactions vocales |
| 5 | Fiabilité et monétisation | SFA, Wallet et facturation |
| 6 | Géospatial avancé | Drones, orthomosaïques et analyses avancées |
| 7 | Écosystème et passage à l'échelle | APIs partenaires et déploiement multi-territoire |

Les phases représentent un ordre de dépendance fonctionnelle. Elles ne constituent pas un calendrier fixe. Certaines préparations peuvent se dérouler en parallèle si elles ne bloquent pas le MVP.

---

## 4. Phase 0 — Fondations techniques et architecture

### Objectif

Mettre en place le socle technique sur lequel reposera l'ensemble de PEST AI OS.

### Périmètre

- Organisation du dépôt et structure du backend.
- Mise en place de Django et Django REST Framework.
- Configuration PostgreSQL et PostGIS.
- Configuration des environnements de développement, staging et production.
- Gestion des variables d'environnement et des secrets.
- Authentification et gestion des utilisateurs.
- Rôles, permissions et séparation des organisations.
- Structure des applications Django par domaine fonctionnel.
- Gestion des migrations de base de données.
- Configuration des tests automatisés.
- Préparation de la CI/CD.
- Documentation technique et conventions de développement.
- Préparation du stockage de fichiers et médias.

### Dépendances

Aucune dépendance fonctionnelle préalable. Cette phase s'appuie sur les documents d'architecture et les spécifications existantes.

### Livrables

- Backend initial opérationnel.
- Base PostgreSQL/PostGIS configurée.
- Authentification fonctionnelle.
- Socle multi-organisation.
- Structure modulaire du code.
- Environnements configurés.
- Premières migrations et tests.
- Pipeline de validation et de déploiement initial.

### Critères de validation

- Un utilisateur peut s'authentifier.
- Les permissions sont appliquées côté serveur.
- Une organisation ne peut pas accéder aux données d'une autre organisation sans autorisation.
- Les migrations fonctionnent correctement.
- Les tests automatisés peuvent être exécutés.
- L'application peut être déployée dans un environnement de test.

### Hors périmètre

Les fonctionnalités agricoles avancées et les modèles IA ne sont pas encore développés.

---

## 5. Phase 1 — MVP agricole opérationnel

### Objectif

Permettre à une coopérative ou une organisation agricole de gérer ses producteurs, ses parcelles et ses activités agricoles depuis PEST AI OS.

Cette phase constitue le premier produit réellement utilisable sur le terrain.

### Périmètre

**Gestion des utilisateurs et organisations**
- Producteurs.
- Agents terrain.
- Agronomes.
- Coopératives et organisations.
- Affectations et permissions.

**AgroID et parcelles**
- Création et gestion des parcelles.
- Identifiant numérique unique AgroID.
- Géométrie et localisation des parcelles.
- Affectation des producteurs.
- Historique des modifications essentielles.

**Gestion agricole**
- Cultures et variétés.
- Campagnes agricoles.
- Cycles de culture.
- Dates et principales étapes culturales.
- Informations déclarées par les producteurs.

**Opérations terrain**
- Missions des agents.
- Affectations des missions.
- Visites de parcelles.
- Observations agricoles.
- Photos et pièces jointes.
- Rapports de terrain.

**Interfaces**
- Interface web PEST AI OS pour les organisations.
- Application mobile Producteur.
- Application mobile Agent terrain.
- Gestion des sessions et permissions.
- Synchronisation des données essentielles.

**Fonctionnement terrain**
- Enregistrement local des données essentielles.
- Synchronisation lorsque le réseau est disponible.
- Gestion des conflits de synchronisation.
- Indication de l'état de synchronisation.

### Dépendances

- Phase 0 validée.
- Modèle de données initial défini.
- Parcours utilisateurs validés.
- Permissions et rôles opérationnels.

### Livrables

- Gestion des organisations et des utilisateurs.
- Registre des producteurs.
- Registre des parcelles AgroID.
- Gestion des campagnes et cycles.
- Gestion des missions et visites.
- Collecte des observations et médias.
- Interfaces web et mobiles utilisables.
- Synchronisation hors ligne des opérations prioritaires.

### Critères de validation

Un scénario réel doit pouvoir être exécuté de bout en bout :

1. Une organisation crée son espace.
2. Elle ajoute un producteur.
3. Elle enregistre une parcelle.
4. Un identifiant AgroID est attribué.
5. Un agent reçoit une mission.
6. L'agent réalise une visite.
7. Il enregistre des observations et des photos.
8. Les informations sont synchronisées.
9. L'organisation retrouve l'historique de la parcelle.

### Hors périmètre

- Analyses IA complexes.
- Traitement avancé d'images satellitaires.
- Orthomosaïques de drones.
- Intégrations bancaires.
- Automatisation complète du SFA.

---

## 6. Phase 2 — Intelligence agricole et analyses IA

### Objectif

Transformer les données collectées en informations agricoles exploitables et en recommandations contextualisées.

### Périmètre

- Gestion des observations destinées aux analyses IA.
- Création et suivi des tâches d'analyse.
- Gestion des modèles IA et de leurs versions.
- Analyse d'images agricoles.
- Détection et classification de problèmes agricoles selon les capacités validées des modèles.
- Production de diagnostics et d'éléments de preuve.
- Génération de recommandations.
- Historique des analyses.
- Validation et correction par un agronome.
- Suivi des recommandations et interventions.
- Traçabilité des résultats et de leur niveau de confiance.

### Dépendances

- Données agricoles structurées issues de la phase 1.
- Médias et observations correctement associés aux parcelles.
- Modèles IA disponibles et évalués.
- Processus de validation agronomique défini.

### Livrables

- Service d'analyse IA.
- Gestion des modèles et versions.
- Historique des diagnostics.
- Recommandations contextualisées.
- Interface de validation agronomique.
- Suivi des actions recommandées.

### Critères de validation

- Une observation peut déclencher une analyse.
- Le résultat est associé à la parcelle et à son contexte agricole.
- La version du modèle utilisé est identifiable.
- L'agronome peut valider ou corriger le résultat.
- Les recommandations et leurs suivis sont historisés.
- Un résultat IA non confirmé n'est pas présenté comme une certitude agronomique.

### Hors périmètre

- Automatisation de décisions financières.
- Traitement avancé des données drones.
- Intelligence conversationnelle complète.

---

## 7. Phase 3 — Données géospatiales, satellite et AgroShield

### Objectif

Enrichir la connaissance des parcelles avec des données géospatiales, satellitaires et environnementales.

### Périmètre

**Données satellitaires**
- Association des images aux parcelles.
- Acquisition et archivage des données disponibles.
- Historique temporel.
- Calcul d'indices adaptés aux bandes disponibles.
- NDVI, NDWI et NDRE lorsque les données le permettent.
- Visualisation des évolutions de parcelles.

**Données environnementales**
- Données météorologiques.
- Température et précipitations.
- Microclimats lorsque les données sont disponibles.
- Association des informations environnementales aux cycles agricoles.

**AgroShield**
- Enregistrement des équipements.
- Association des capteurs aux parcelles.
- Collecte des mesures.
- Historique des relevés.
- Alertes basées sur des seuils validés.

**Infrastructure géospatiale**
- Gestion des géométries.
- Traitement des données spatiales.
- Stockage des métadonnées.
- Services cartographiques.

### Dépendances

- Parcelles géoréférencées.
- Données agricoles contextualisées.
- Sources de données satellitaires et environnementales identifiées.
- Protocoles d'intégration des capteurs définis.

### Livrables

- Service géospatial.
- Historique des images et mesures.
- Visualisation cartographique.
- Premiers indicateurs satellitaires.
- Module d'intégration AgroShield.
- Données environnementales associées aux parcelles.

### Critères de validation

- Les données géospatiales sont correctement associées aux parcelles.
- Les images sont traçables dans le temps.
- Les indices sont calculés uniquement lorsque les bandes nécessaires sont disponibles.
- Les mesures de capteurs sont historisées et contextualisées.
- Les anomalies détectées sont présentées comme des signaux à vérifier, et non comme des diagnostics définitifs.

### Hors périmètre

- Acquisition obligatoire d'un drone.
- Traitement photogrammétrique avancé.
- Construction complète d'orthomosaïques.

---

## 8. Phase 4 — Fary et intelligence conversationnelle

### Objectif

Permettre aux producteurs et aux agents d'interagir avec PEST AI OS en langage naturel, notamment par la voix.

### Périmètre

- Gestion des conversations.
- Gestion des participants.
- Historique des messages.
- Pièces jointes et messages vocaux.
- Traitement ASR (reconnaissance vocale).
- Traitement TTS (synthèse vocale).
- Intégration de Fary.
- Prise en charge du français, du wolof et du pulaar selon les capacités validées.
- Réponses contextualisées selon le profil, la parcelle et le cycle agricole.
- Mémoire agricole sélective.
- Gestion des tâches vocales asynchrones.
- Synchronisation des interactions lorsque le réseau est disponible.

### Dépendances

- Données producteur et parcelle disponibles.
- Services IA opérationnels.
- Capacités linguistiques de Fary évaluées.
- Règles de confidentialité et de conservation des conversations définies.

### Livrables

- Module conversationnel.
- Gestion des messages et conversations.
- Services ASR/TTS.
- Historique des interactions.
- Mémoire agricole contextualisée.
- Interface vocale mobile.

### Critères de validation

- Un producteur peut envoyer un message vocal.
- Le système peut le transcrire lorsque la langue et le modèle le permettent.
- Une réponse vocale peut être générée.
- Les réponses peuvent tenir compte du contexte agricole autorisé.
- Les informations mémorisées sont distinguées selon leur origine : déclaration du producteur, hypothèse IA ou validation agronomique.
- La mémoire n'enregistre pas automatiquement et indéfiniment toutes les conversations.

### Hors périmètre

- Assistant autonome prenant des décisions agronomiques ou financières sans validation.
- Conservation permanente de toutes les conversations.

---

## 9. Phase 5 — SFA, Wallet et monétisation

### Objectif

Mettre en place les mécanismes de fiabilité agricole, de facturation et de financement des services PEST AI.

### Périmètre

**SFA**
- Profil de fiabilité agricole.
- Calcul d'un score dynamique.
- Historique des facteurs et indicateurs.
- Justification et traçabilité des résultats.
- Gestion du consentement au partage.
- Préparation des échanges avec les partenaires financiers.

**Wallet**
- Portefeuille individuel en FCFA.
- Solde disponible.
- Rechargement.
- Crédits achetés.
- Crédits promotionnels.
- Historique des transactions.
- Réservation et confirmation des consommations.

**Monétisation**
- Catalogue des services payants.
- Tarification par service.
- Mesure de consommation.
- Facturation.
- Budgets organisationnels.
- Quotas et allocations par utilisateur ou service.
- Historique des opérations financières.

**Règles financières**
- Les crédits achetés ne périment pas.
- Les crédits promotionnels peuvent avoir une date d'expiration.
- Le coût d'une opération doit être affiché avant confirmation.
- Une opération payante doit réserver le montant nécessaire avant exécution.
- Le débit définitif intervient après réussite de l'opération.
- En cas d'échec, la réservation est libérée ou remboursée selon le statut.
- Les opérations doivent être idempotentes afin d'éviter les doubles débits.
- Le registre des transactions doit être traçable et non modifiable rétroactivement.

**Offre coopérative**
- Gestion des contrats et campagnes de service.
- Tarification cible de 24 900 FCFA par hectare et par saison.
- Suivi des surfaces couvertes et des services inclus.

### Dépendances

- Identités et organisations opérationnelles.
- Données agricoles et historiques suffisamment fiables.
- Catalogue et règles de tarification validés.
- Prestataire de paiement sélectionné avant intégration effective.
- Méthodologie SFA documentée et validée.

### Livrables

- Module SFA.
- Wallet individuel.
- Gestion des crédits.
- Registre des transactions.
- Gestion des consommations.
- Gestion des budgets organisationnels.
- Facturation.
- Préparation des interfaces partenaires financiers.

### Critères de validation

- Les scores SFA sont calculables et traçables.
- Le score évolue en fonction des données disponibles.
- Le partage des informations avec un partenaire exige le consentement approprié.
- Une opération payante ne peut pas être exécutée sans autorisation financière.
- Un même événement ne peut pas générer deux débits.
- Les transactions et soldes peuvent être audités.
- Les dépenses individuelles et organisationnelles sont correctement séparées.

### Limites

PEST AI fournit des informations et indicateurs de fiabilité. La décision d'accorder un crédit ou une assurance reste celle du partenaire financier.

---

## 10. Phase 6 — Géospatial avancé et drones

### Objectif

Développer les capacités avancées d'observation et d'analyse des parcelles grâce aux images de drones et à la télédétection.

### Périmètre

- Gestion des missions de drones.
- Enregistrement des vols.
- Association des missions aux parcelles.
- Importation d'images RGB et multispectrales.
- Gestion des métadonnées.
- Traitement photogrammétrique.
- Génération d'orthomosaïques.
- Superposition des couches géospatiales.
- Calcul d'indices selon les bandes disponibles.
- Comparaison temporelle des parcelles.
- Analyse multi-parcelles et multi-campagnes.
- Archivage des résultats et traçabilité des traitements.

### Dépendances

- Infrastructure géospatiale opérationnelle.
- Gestion fiable des parcelles.
- Stockage des images.
- Chaîne de traitement et capacités matérielles adaptées.
- Équipements et prestataires drones disponibles.

### Livrables

- Module de gestion des missions drones.
- Pipeline d'importation et de traitement.
- Gestion des orthomosaïques.
- Visualisation et superposition des couches.
- Historique géospatial avancé.

### Critères de validation

- Une mission de drone est associée à une zone et à une date.
- Les images sources sont conservées et identifiables.
- Les orthomosaïques sont liées aux parcelles concernées.
- Les traitements sont reproductibles et traçables.
- Les résultats peuvent être comparés dans le temps.

### Hors périmètre

L'achat d'un drone n'est pas une condition préalable au démarrage du MVP. Cette phase peut commencer avec des images fournies par des partenaires.

---

## 11. Phase 7 — Écosystème, intégrations et passage à l'échelle

### Objectif

Faire évoluer PEST AI OS vers une infrastructure agricole interconnectée, utilisable par plusieurs catégories d'acteurs et sur plusieurs territoires.

### Périmètre

- APIs partenaires.
- Intégrations banques et assurances.
- Intégrations institutionnelles.
- Gestion des programmes agricoles.
- Tableaux de bord territoriaux.
- Analyses multi-organisations.
- Gestion multi-régions et multi-pays.
- Gouvernance et qualité des données.
- Optimisation des performances.
- Surveillance des coûts d'infrastructure et d'IA.
- Renforcement de la sécurité.
- Amélioration de la disponibilité et de la résilience.

### Dépendances

- Modules métiers stabilisés.
- Qualité et gouvernance des données.
- APIs documentées et versionnées.
- Accords et protocoles avec les partenaires.
- Capacité opérationnelle et infrastructure adaptée.

### Livrables

- Portail et APIs partenaires.
- Connecteurs institutionnels et financiers.
- Tableaux de bord avancés.
- Outils de gouvernance des données.
- Infrastructure optimisée pour la montée en charge.

### Critères de validation

- Les partenaires peuvent accéder uniquement aux données autorisées.
- Les échanges sont sécurisés et traçables.
- Les performances répondent aux objectifs définis.
- Les services peuvent être déployés sur de nouveaux territoires sans refonte de l'architecture.
- Les coûts et la qualité des services sont mesurables.

---

## 12. Chantiers transversaux

Certains chantiers doivent accompagner toutes les phases.

### Sécurité et gouvernance
- Authentification et autorisations.
- Isolation des organisations.
- Gestion des consentements.
- Journalisation et audit.
- Protection des données.
- Gestion des secrets.

### Qualité logicielle
- Tests unitaires.
- Tests d'intégration.
- Tests API.
- Tests de non-régression.
- Documentation technique.
- Revue de code.

### DevOps et infrastructure
- Environnements Dev, Staging et Production.
- CI/CD.
- Migrations contrôlées.
- Sauvegardes.
- Monitoring et alertes.
- Gestion des erreurs.
- Gestion des performances.

### Données et IA
- Qualité des données.
- Traçabilité des transformations.
- Versionnement des modèles.
- Évaluation des modèles.
- Supervision humaine.
- Suivi des coûts de traitement.

### Expérience terrain
- Compatibilité avec les appareils Android d'entrée de gamme.
- Interfaces adaptées à une utilisation à une main.
- Fonctionnement avec réseau faible ou intermittent.
- Synchronisation robuste.
- Messages d'erreur compréhensibles.

---

## 13. Règles de passage entre les phases

Une phase ne doit pas être considérée comme terminée uniquement parce que son développement est achevé.

Elle doit satisfaire ses critères de validation.

Le passage à la phase suivante nécessite :

1. Les fonctionnalités prévues sont développées.
2. Les tests essentiels sont validés.
3. Les données sont correctement enregistrées et protégées.
4. Les dépendances de la phase suivante sont disponibles.
5. La documentation est mise à jour.
6. Les scénarios d'utilisation sont vérifiés.
7. Les anomalies bloquantes sont corrigées.

Les fonctionnalités non bloquantes peuvent être reportées à une version ultérieure, avec une décision documentée.

## 14. Gestion des évolutions

Toute nouvelle fonctionnalité doit être évaluée selon :

- Sa valeur pour les utilisateurs.
- Son importance pour le MVP ou une phase future.
- Ses dépendances techniques.
- Son impact sur le modèle de données.
- Son impact sur la sécurité.
- Son coût de développement et d'exploitation.
- Sa compatibilité avec l'architecture globale.

Une fonctionnalité future ne doit pas être développée prématurément simplement parce qu'elle est prévue dans l'architecture.

À l'inverse, son existence doit être anticipée lorsque cela évite une refonte structurelle ultérieure.

## 15. Relation avec les autres documents

Cette feuille de route complète les documents suivants :

- `Technical-Architecture-Specification.md` : spécification technique de référence.
- `PEST-AI-OS-Global-Architecture.md` : architecture globale et domaines fonctionnels.
- `PEST-AI-OS-Implementation-Roadmap.md` : ordre de réalisation et critères de validation.
- `PEST-AI-OS-Data-Model.md` : modèle conceptuel des données et relations entre entités.

Le modèle de données détaillé devra distinguer les entités nécessaires au MVP de celles prévues pour les phases ultérieures, sans empêcher leur intégration future.

## 16. Résultat attendu

À terme, PEST AI OS doit permettre de suivre le parcours complet :

**Producteur → Parcelle AgroID → Données agricoles → Observation terrain → Intelligence IA → Données géospatiales → Recommandations → Traçabilité → Fiabilité SFA → Services agricoles et financiers.**

La construction sera progressive, mais l'ensemble doit rester cohérent au sein d'une même infrastructure.
