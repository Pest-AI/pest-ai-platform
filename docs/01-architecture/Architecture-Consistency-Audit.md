# PEST AI OS — Architecture Consistency Audit

## 1. Purpose

This document consolidates the architecture consistency review of PEST AI OS.

It complements:
- `Technical-Architecture-Specification.md`
- `PEST-AI-OS-Global-Architecture.md`
- `PEST-AI-OS-Implementation-Roadmap.md`
- `PEST-AI-OS-Data-Model.md`

The objective is to remove ambiguities before generating the relational database schema and Entity Relationship Diagrams (ERDs).

The architecture must describe the complete target platform while clearly distinguishing MVP scope from future capabilities.

## 2. Validated Architecture Decisions

### 2.1 AI in the MVP

The MVP must include a limited but operational agricultural AI diagnostic capability.

MVP:
- Field observations and evidence collection.
- Initial AI analysis and diagnostic generation.
- Confidence level associated with AI results.
- Agronomist review and validation.

Phase 2:
- Extended crop and disease coverage.
- Improved AI models.
- Contextual recommendations.
- Intervention follow-up.
- Continuous model improvement.

AI must not be entirely postponed to Phase 2.

### 2.2 Wallet ownership and financial responsibilities

The financial model must distinguish:

- Wallet owner.
- Payer or funder.
- Beneficiary.
- Service consumer.

Both individual producers and organizations may own wallets.

Field agents may receive operational budgets or quotas from an organization without owning a personal wallet.

Organizations may finance services for producers under explicit coverage rules.

Financial transactions must support:
- Append-only transaction history.
- Reservation and confirmation mechanisms.
- Release or refund when an operation fails.
- Idempotency and duplicate prevention.
- Cost, status, payer, beneficiary and service traceability.

Purchased balances do not expire. Promotional credits may have expiration rules.

### 2.3 Parcel ownership and agricultural operation

The parcel model must distinguish:

- Land owner or legal rights holder.
- Actual agricultural operator or producer.
- Supporting organization or cooperative.

These roles must not be represented as a single relationship.

A parcel's AgroID remains stable when ownership, operational responsibility or organizational affiliation changes.

Assignments and ownership rights must be historized with effective dates.

### 2.4 Centralized file management

Introduce a centralized `FileAsset` entity.

It must reference files used by:
- Field observations.
- Field visits.
- Agricultural documents.
- Satellite imagery.
- Drone imagery and orthomosaics.
- Fary conversations and voice processing.
- AI diagnostic evidence.

Binary files must be stored in S3-compatible object storage.

PostgreSQL stores metadata, storage references, ownership and business relationships.

Avoid duplicating file management logic across domains.

### 2.5 Offline-first synchronization

The mobile application must support offline field operations.

Requirements:
- Local creation of field visits, observations and media.
- Unique operation identifiers generated locally.
- Automatic synchronization after reconnection.
- Idempotent server processing and duplicate prevention.
- Conflict tracking and resolution.
- Author, device, local timestamp and server synchronization timestamp.
- Traceability of synchronization operations.

Financial operations must remain pending until confirmed by the server. An offline operation must never be presented as a completed financial transaction without server confirmation.

### 2.6 SFA as an independent business domain

SFA must be modeled as a dedicated domain.

Recommended entities:
- `SFAProfile`
- `SFAAssessment`
- `SFACriterion`
- `SFAEvidence`
- `SFAScoreHistory`
- `SFAConsent`
- `SFADataSharing`

The SFA score is dynamic, explainable and evidence-based.

Producer consent is required before sharing information with financial or insurance partners.

PEST AI provides agricultural reliability information. Lending and insurance decisions remain the responsibility of the relevant partners.

### 2.7 Agricultural product catalog normalization

Use one canonical `AgriculturalProduct` entity.

Separate:
- `AgriculturalProduct`: central agricultural product and input reference.
- `SupplierProduct`: commercial offer published by a supplier.
- `ProductRecommendation`: link between a recommended product and an agricultural recommendation.

One agricultural product may have multiple supplier offers and may be recommended in different agricultural contexts.

Do not create duplicate product catalog entities across domains.

## 3. Additional Modeling Requirements

### 3.1 Multi-organization architecture

The relational model must support:
- Multiple organizations.
- Users belonging to multiple organizations where applicable.
- Explicit organization memberships and roles.
- Organization-scoped permissions.
- Data isolation and controlled sharing.

### 3.2 Agricultural and parcel traceability

The model must preserve relationships between:
- Producers.
- Parcels and AgroID.
- Cultivation units.
- Agricultural campaigns.
- Crop cycles.
- Field missions and visits.
- Observations.
- Diagnostics.
- Recommendations.
- Follow-up actions.

Historical information must not be overwritten when operational assignments change.

### 3.3 Geospatial data

Use PostgreSQL/PostGIS for structured geographic data.

Distinguish:
- Parcel identity and metadata.
- Parcel geometry and geometry versions.
- Satellite acquisitions.
- Drone missions and flights.
- Orthomosaics and derived products.
- Vegetation indices.
- Environmental measurements.

Satellite and drone imagery must be stored as files, with their metadata and processing history represented in the database.

Imagery anomalies are indicators for investigation, not confirmed agricultural diagnoses.

### 3.4 Fary and agricultural memory

Fary must support French, Wolof and Pulaar.

The data model must distinguish:
- Conversations and messages.
- Voice processing jobs.
- Transcriptions.
- AI interactions.
- Selective agricultural memory.

Agricultural memory must distinguish producer-declared facts, AI-generated hypotheses and agronomist-confirmed information.

Do not permanently store every conversation as validated agricultural knowledge.

### 3.5 Financial traceability

The financial model must support:
- Individual and organizational wallets.
- Wallet funding.
- Credit lots.
- Promotional credits and expiration rules.
- Service usage.
- Usage reservations.
- Billing records.
- Organizational budgets and quotas.

The model must distinguish the payer from the beneficiary and the service consumer.

Payment provider selection remains an implementation decision and must not be invented during database modeling.

## 4. ERD and Relational Schema Generation Requirements

The future relational model must provide:

1. A complete global ERD.
2. Separate ERDs for each business domain.
3. Table definitions and column descriptions.
4. Primary keys and foreign keys.
5. Relationship cardinalities.
6. Nullability and uniqueness constraints.
7. Index recommendations.
8. Historical and audit mechanisms.
9. Multi-organization isolation rules.
10. MVP versus future-phase classification.
11. Django model recommendations.
12. PostgreSQL/PostGIS compatibility.

The model must avoid duplicate entities and unclear ownership relationships.

## 5. Open Modeling Rules

Where implementation details are not yet decided, the model generator must:
- Explicitly identify the unresolved point.
- Propose a reasonable technical option.
- Explain the consequences.
- Mark it as an assumption requiring validation.

It must never silently invent critical business rules.

## 6. Final Architecture Principle

PEST AI OS is a modular agricultural intelligence platform.

Its architecture must support a coherent global data model from the beginning while allowing progressive implementation through the defined roadmap.

The MVP is the first operational slice of the target platform, not a separate or disposable architecture.

All future modules must integrate into the same identity, parcel, agricultural, geospatial, intelligence and traceability foundations.
