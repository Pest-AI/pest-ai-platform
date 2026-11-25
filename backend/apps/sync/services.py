"""Application des opérations hors ligne (J20).

Chaque opération est rejouée **par la même vue que la saisie en ligne** (mêmes permissions,
mêmes contrôles, mêmes services) : la synchronisation n'ouvre aucun chemin d'écriture
parallèle. Une opération tourne dans son propre point de sauvegarde : une réponse en erreur
annule tout ce qu'elle aurait pu écrire.

- idempotence : l'identifiant de l'opération est tiré sur l'appareil ; une opération déjà
  reçue renvoie le résultat enregistré, sans rien rejouer ;
- références : une valeur « @op:<uuid> » désigne l'objet créé par une opération précédente
  du même utilisateur (parcelle enrôlée hors ligne, puis son unité, son cycle…) ;
- conflits : une modification fondée sur une version dépassée (`base_row_version`) n'est pas
  appliquée ; elle est enregistrée en `SyncConflict`, jamais écrasée en silence.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass

from django.db import IntegrityError, transaction
from django.test.client import RequestFactory
from django.urls import Resolver404, resolve
from django.utils import timezone

from apps.sync.models import (
    ConflictType,
    Device,
    DeviceStatus,
    OperationStatus,
    SessionStatus,
    SyncConflict,
    SyncOperation,
    SyncSession,
)

logger = logging.getLogger("pestai.sync")
REF = re.compile(r"^@op:([0-9a-f-]{36})$")
MAX_OPERATIONS = 50

# (type d'objet, opération) → (méthode, chemin de la vue en ligne). {param} : `params` de l'op.
ROUTES = {
    ("producer", "create"): ("POST", "/api/v1/producers/"),
    ("parcel", "create"): ("POST", "/api/v1/parcels/"),
    ("parcel_site", "create"): ("POST", "/api/v1/parcels/{parcel}/site/"),
    ("cultivation_unit", "create"): ("POST", "/api/v1/parcels/{parcel}/units/"),
    ("crop_cycle", "create"): ("POST", "/api/v1/crop-cycles/"),
    ("crop_cycle", "update"): ("PATCH", "/api/v1/crop-cycles/{entity}/"),
    ("crop_operation", "create"): ("POST", "/api/v1/crop-cycles/{cycle}/operations/"),
    ("harvest", "create"): ("POST", "/api/v1/crop-cycles/{cycle}/harvests/"),
}
# Objets dont la modification vérifie la version connue de l'appareil.
VERSIONED = {
    "crop_cycle": ("apps.agriculture.models", "CropCycle", "/api/v1/crop-cycles/{entity}/")
}
RESULT_KEYS = ("id", "agroid", "producer_code", "code", "status", "row_version", "check", "area_m2")


class Pending(Exception):
    """Une référence vise une opération pas (encore) appliquée."""


@dataclass
class Outcome:
    status: str
    error_code: str = ""
    result: dict | None = None
    conflict: dict | None = None
    entity_id: str | None = None


def register_device(user, info: dict) -> Device:
    """Appareil de l'utilisateur (créé à la première synchronisation)."""
    device = Device.objects.filter(installation_id=info["installation_id"]).first()
    if device is None:
        device = Device.objects.create(
            user=user,
            installation_id=info["installation_id"],
            platform=info["platform"],
            app_version=info.get("app_version", ""),
            os_version=info.get("os_version", ""),
            model=info.get("model", ""),
            created_by=user,
            updated_by=user,
        )
    elif device.user_id != user.pk:
        raise PermissionError("device_other_user")
    elif device.status != DeviceStatus.ACTIVE:
        raise PermissionError("device_revoked")
    device.last_seen_at = timezone.now()
    device.app_version = info.get("app_version", device.app_version)
    device.save(update_fields=["last_seen_at", "app_version", "updated_at"])
    return device


def _resolve_refs(value, user):
    if isinstance(value, dict):
        return {k: _resolve_refs(v, user) for k, v in value.items()}
    if isinstance(value, list):
        return [_resolve_refs(v, user) for v in value]
    if isinstance(value, str) and (m := REF.match(value)):
        op = SyncOperation.objects.filter(pk=m.group(1), user=user).first()
        if op is None or op.status != OperationStatus.APPLIED or not (op.result or {}).get("id"):
            raise Pending(m.group(1))
        return op.result["id"]
    return value


def _call(user, workspace_header: str, method: str, path: str, body: dict | None):
    """Rejoue la saisie sur la vue en ligne, au nom de l'utilisateur authentifié."""
    factory = RequestFactory()
    if method == "GET":
        request = factory.get(path, HTTP_X_WORKSPACE=workspace_header)
    else:
        request = getattr(factory, method.lower())(
            path,
            data=json.dumps(body or {}),
            content_type="application/json",
            HTTP_X_WORKSPACE=workspace_header,
        )
    request._force_auth_user = user  # authentification déjà faite par la requête de synchro
    match = resolve(path)
    response = match.func(request, *match.args, **match.kwargs)
    return response.status_code, getattr(response, "data", None)


def _summary(data) -> dict:
    if not isinstance(data, dict):
        return {}
    out = {k: data[k] for k in RESULT_KEYS if k in data}
    assignment = data.get("assignment")
    if isinstance(assignment, dict) and assignment.get("membership_number"):
        out["membership_number"] = assignment["membership_number"]
    return out


def _version_check(op, user, workspace_header, entity_id):
    spec = VERSIONED.get(op["entity_type"])
    if not spec or op.get("base_row_version") is None or not entity_id:
        return None
    module, name, path = spec
    from importlib import import_module

    model = getattr(import_module(module), name)
    row = model.objects.filter(pk=entity_id).values("row_version", "is_archived").first()
    if row is None:
        return None  # la vue répondra 404
    if row["is_archived"]:
        kind = ConflictType.ARCHIVED_ON_SERVER
    elif row["row_version"] != op["base_row_version"]:
        kind = ConflictType.CONCURRENT_UPDATE
    else:
        return None
    _, snapshot = _call(user, workspace_header, "GET", path.format(entity=entity_id), None)
    return kind, row["row_version"], json.loads(json.dumps(snapshot or {}, default=str))


def apply_operation(op: dict, *, user, workspace_header: str) -> Outcome:
    route = ROUTES.get((op["entity_type"], op["operation"]))
    if route is None:
        return Outcome(OperationStatus.REJECTED, "unsupported_operation")
    try:
        params = _resolve_refs(op.get("params") or {}, user)
        payload = _resolve_refs(op.get("payload") or {}, user)
        entity_id = _resolve_refs(op.get("entity_id"), user) if op.get("entity_id") else None
    except Pending:
        return Outcome("pending", "dependency_pending")
    method, template = route
    try:
        path = template.format(entity=entity_id, **params)
        resolve(path)
    except (KeyError, Resolver404):
        return Outcome(OperationStatus.REJECTED, "bad_parameters")

    conflict = _version_check(op, user, workspace_header, entity_id)
    if conflict:
        kind, server_version, snapshot = conflict
        return Outcome(
            OperationStatus.CONFLICT,
            kind,
            conflict={
                "type": kind,
                "server_row_version": server_version,
                "server_snapshot": snapshot,
            },
            entity_id=entity_id,
        )

    with transaction.atomic():
        code, data = _call(user, workspace_header, method, path, payload)
        if code >= 400:
            transaction.set_rollback(True)
    data = json.loads(json.dumps(data, default=str)) if data is not None else None
    if code == 429 or code >= 500:
        return Outcome("retry", "server_busy")  # rien d'enregistré : l'appareil renverra
    if 200 <= code < 300:
        result = _summary(data)
        return Outcome(
            OperationStatus.APPLIED, result=result, entity_id=result.get("id") or entity_id
        )
    errors = {
        403: "permission_denied",
        404: "not_found",
        409: "duplicate_candidates",
    }
    return Outcome(
        OperationStatus.REJECTED,
        errors.get(code, "validation_failed"),
        result=data,
        entity_id=entity_id,
    )


def _apply_and_record(op, user, workspace_header, session, device, space):
    outcome = apply_operation(op, user=user, workspace_header=workspace_header)
    if outcome.status in ("pending", "retry"):
        return outcome, None
    record = SyncOperation.objects.create(
        id=op["id"],
        session=session,
        device=device,
        user=user,
        entity_type=op["entity_type"],
        entity_id=outcome.entity_id,
        operation=op["operation"],
        payload={"params": op.get("params") or {}, "payload": op.get("payload") or {}},
        base_row_version=op.get("base_row_version"),
        client_created_at=op["client_created_at"],
        client_sequence=op["client_sequence"],
        received_at=session.started_at,
        processed_at=timezone.now(),
        status=outcome.status,
        error_code=outcome.error_code,
        result=outcome.result,
        created_by=user,
        updated_by=user,
        **space,
    )
    if outcome.conflict:
        SyncConflict.objects.create(
            operation=record,
            entity_type=op["entity_type"],
            entity_id=outcome.entity_id,
            conflict_type=outcome.conflict["type"],
            server_row_version=outcome.conflict["server_row_version"],
            client_base_row_version=op.get("base_row_version"),
            server_snapshot=outcome.conflict["server_snapshot"],
            client_payload=op.get("payload") or {},
            created_by=user,
            updated_by=user,
            **space,
        )
    return outcome, record


def push(*, user, workspace, workspace_header: str, device_info: dict, operations: list[dict]):
    """Reçoit un lot d'opérations d'un appareil, dans l'ordre de l'appareil."""
    device = register_device(user, device_info)
    space = (
        {"organization": workspace.organization}
        if workspace.organization is not None
        else {"personal_producer": workspace.producer}
    )
    session = SyncSession.objects.create(
        device=device,
        user=user,
        started_at=timezone.now(),
        ops_received=len(operations),
        app_version=device_info.get("app_version", ""),
        created_by=user,
        updated_by=user,
        **space,
    )
    results = []
    counts = {s: 0 for s in OperationStatus.values}
    for op in sorted(operations, key=lambda o: o["client_sequence"]):
        existing = SyncOperation.objects.filter(pk=op["id"]).first()
        if existing is not None:
            if existing.user_id != user.pk:
                results.append(
                    {
                        "id": str(op["id"]),
                        "status": OperationStatus.REJECTED,
                        "error_code": "foreign_operation",
                    }
                )
                counts[OperationStatus.REJECTED] += 1
                continue
            results.append(
                {
                    "id": str(existing.pk),
                    "status": OperationStatus.DUPLICATE,
                    "original_status": existing.status,
                    "error_code": existing.error_code,
                    "result": existing.result,
                }
            )
            counts[OperationStatus.DUPLICATE] += 1
            continue
        try:
            with transaction.atomic():  # données et trace de l'opération ensemble, ou rien
                outcome, record = _apply_and_record(
                    op, user, workspace_header, session, device, space
                )
        except IntegrityError:
            results.append(
                {
                    "id": str(op["id"]),
                    "status": OperationStatus.REJECTED,
                    "error_code": "sequence_reused",
                }
            )
            counts[OperationStatus.REJECTED] += 1
            continue
        except Exception:  # erreur imprévue : rien d'enregistré, l'appareil renverra
            logger.exception("sync_operation_failed", extra={"operation": str(op["id"])})
            results.append({"id": str(op["id"]), "status": "retry", "error_code": "server_error"})
            continue
        if record is None:
            # Rien n'est enregistré : l'appareil la renverra après l'opération dont elle dépend.
            results.append(
                {"id": str(op["id"]), "status": "pending", "error_code": outcome.error_code}
            )
            continue
        counts[outcome.status] += 1
        results.append(
            {
                "id": str(record.pk),
                "status": outcome.status,
                "error_code": outcome.error_code,
                "result": outcome.result,
            }
        )
    session.ops_applied = counts[OperationStatus.APPLIED]
    session.ops_duplicate = counts[OperationStatus.DUPLICATE]
    session.ops_conflict = counts[OperationStatus.CONFLICT]
    session.ops_rejected = counts[OperationStatus.REJECTED]
    session.finished_at = timezone.now()
    session.status = (
        SessionStatus.COMPLETED
        if not (session.ops_conflict or session.ops_rejected)
        else SessionStatus.PARTIAL
    )
    session.save()
    return session, results
