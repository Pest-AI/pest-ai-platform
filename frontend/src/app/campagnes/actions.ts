"use server";

/**
 * Actions serveur Campagnes et cycles (J17). L'API revérifie l'espace, les permissions
 * (campaigns.*, crop_cycles.*) et toutes les règles (dates, statuts, espace).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { currentWorkspace, getApi } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { previousFromForm } from "@/lib/agriculture";

export type FormState = { status: "idle" | "error" | "done"; message?: string };

const UUID = /^[0-9a-f-]{36}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

function optionalDate(form: FormData, name: string): string | null {
  const v = text(form, name);
  return DATE.test(v) ? v : null;
}

function optionalNumber(form: FormData, name: string): string | null {
  const v = text(form, name).replace(",", ".").replace(/\s/g, "");
  return v && Number.isFinite(Number(v)) && Number(v) >= 0 ? v : null;
}

async function context() {
  const workspace = await currentWorkspace();
  if (!workspace) return null;
  return { api: await getApi(), header: { "X-Workspace": workspace } };
}

function forbidden(status: number): string | null {
  return status === 403 ? "Votre rôle ne permet pas cette action." : null;
}

// ── Campagnes ────────────────────────────────────────────────────────────

export async function createCampaign(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await context();
  if (!ctx) return { status: "error", message: "Aucun espace de travail sélectionné." };
  const start = optionalDate(form, "start_date");
  const year = Number(text(form, "year"));
  if (!start) return { status: "error", message: "Indiquez la date de début." };
  const season = text(form, "season_type") as "rainy" | "cold_dry" | "hot_dry" | "other";
  const { data, error, response } = await ctx.api.POST("/api/v1/campaigns/", {
    params: { header: ctx.header },
    body: {
      name: text(form, "name"),
      season_type: season,
      year: Number.isInteger(year) ? year : Number(start.slice(0, 4)),
      start_date: start,
      end_date: optionalDate(form, "end_date"),
    },
  });
  if (!response.ok || !data) {
    return { status: "error", message: forbidden(response.status) ?? apiErrorMessage(error, "Campagne non créée.") };
  }
  revalidatePath("/campagnes");
  redirect(`/campagnes/${data.id}`);
}

export async function changeCampaignStatus(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await context();
  const id = text(form, "campaign_id");
  if (!ctx || !UUID.test(id)) return { status: "error", message: "Campagne introuvable." };
  const status = text(form, "status") as "planned" | "active" | "closed";
  const { error, response } = await ctx.api.PATCH("/api/v1/campaigns/{id}/", {
    params: { header: ctx.header, path: { id } },
    body: { status },
  });
  if (!response.ok) return { status: "error", message: forbidden(response.status) ?? apiErrorMessage(error) };
  revalidatePath(`/campagnes/${id}`);
  revalidatePath("/campagnes");
  return { status: "done" };
}

// ── Cycles ───────────────────────────────────────────────────────────────

export async function createCycle(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await context();
  if (!ctx) return { status: "error", message: "Aucun espace de travail sélectionné." };
  const parcel = text(form, "parcel");
  if (!UUID.test(parcel)) return { status: "error", message: "Choisissez la parcelle." };
  const crop = text(form, "declared_crop");
  if (!crop) return { status: "error", message: "Choisissez la culture." };
  const unit = text(form, "cultivation_unit");
  const campaign = text(form, "campaign");
  const variety = text(form, "variety");
  const status = text(form, "status") === "in_progress" ? "in_progress" : "planned";
  const { data, error, response } = await ctx.api.POST("/api/v1/crop-cycles/", {
    params: { header: ctx.header },
    body: {
      parcel,
      declared_crop: crop,
      cultivation_unit: UUID.test(unit) ? unit : null,
      campaign: UUID.test(campaign) ? campaign : null,
      variety: UUID.test(variety) ? variety : null,
      planned_sowing_date: optionalDate(form, "planned_sowing_date"),
      sowing_date: optionalDate(form, "sowing_date"),
      expected_harvest_date: optionalDate(form, "expected_harvest_date"),
      declared_area_m2: optionalNumber(form, "declared_area_m2"),
      status,
      seed_source: (text(form, "seed_source") || "") as never,
      planting_method: (text(form, "planting_method") || "") as never,
      ...previousFromForm(text(form, "previous")),
    },
  });
  if (!response.ok || !data) {
    return { status: "error", message: forbidden(response.status) ?? apiErrorMessage(error, "Cycle non enregistré.") };
  }
  revalidatePath("/campagnes");
  redirect(`/cycles/${data.id}?nouveau=1`);
}

export async function updateCycle(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await context();
  const id = text(form, "cycle_id");
  if (!ctx || !UUID.test(id)) return { status: "error", message: "Cycle introuvable." };
  const body: Record<string, string | null> = {};
  const status = text(form, "status");
  if (status) body.status = status;
  for (const name of ["sowing_date", "transplanting_date", "expected_harvest_date", "harvest_end_date"]) {
    if (form.has(name)) body[name] = optionalDate(form, name);
  }
  if (form.has("declared_area_m2")) body.declared_area_m2 = optionalNumber(form, "declared_area_m2");
  if (form.has("seed_source")) body.seed_source = text(form, "seed_source");
  if (form.has("planting_method")) body.planting_method = text(form, "planting_method");
  const extra: Record<string, unknown> = form.has("previous") ? previousFromForm(text(form, "previous")) : {};
  const { error, response } = await ctx.api.PATCH("/api/v1/crop-cycles/{id}/", {
    params: { header: ctx.header, path: { id } },
    body: { ...body, ...extra } as never,
  });
  if (!response.ok) return { status: "error", message: forbidden(response.status) ?? apiErrorMessage(error) };
  revalidatePath(`/cycles/${id}`);
  return { status: "done" };
}

export async function confirmCrop(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await context();
  const id = text(form, "cycle_id");
  if (!ctx || !UUID.test(id)) return { status: "error", message: "Cycle introuvable." };
  const { error, response } = await ctx.api.POST("/api/v1/crop-cycles/{id}/confirm-crop/", {
    params: { header: ctx.header, path: { id } },
    body: { crop: text(form, "crop") },
  });
  if (!response.ok) return { status: "error", message: forbidden(response.status) ?? apiErrorMessage(error) };
  revalidatePath(`/cycles/${id}`);
  return { status: "done" };
}

export async function addOperation(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await context();
  const id = text(form, "cycle_id");
  if (!ctx || !UUID.test(id)) return { status: "error", message: "Cycle introuvable." };
  const done = text(form, "when") !== "planned";
  const date = optionalDate(form, "date");
  if (!date) return { status: "error", message: "Indiquez la date." };
  const { error, response } = await ctx.api.POST("/api/v1/crop-cycles/{id}/operations/", {
    params: { header: ctx.header, path: { id } },
    body: {
      operation_type: text(form, "operation_type") as "other",
      performed_date: done ? date : null,
      planned_date: done ? null : date,
      product_text: text(form, "product_text").slice(0, 200),
      quantity: optionalNumber(form, "quantity"),
      quantity_unit: text(form, "quantity_unit").slice(0, 20),
      notes: text(form, "notes"),
    },
  });
  if (!response.ok) return { status: "error", message: forbidden(response.status) ?? apiErrorMessage(error) };
  revalidatePath(`/cycles/${id}`);
  return { status: "done" };
}

export async function addHarvest(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await context();
  const id = text(form, "cycle_id");
  if (!ctx || !UUID.test(id)) return { status: "error", message: "Cycle introuvable." };
  const date = optionalDate(form, "harvest_date");
  if (!date) return { status: "error", message: "Indiquez la date de récolte." };
  // Unité d'origine : la quantité en kg = nombre × poids unitaire (sac de N kg…).
  const count = optionalNumber(form, "original_quantity");
  const unitKg = optionalNumber(form, "unit_kg");
  const direct = optionalNumber(form, "quantity_kg");
  const kg = count && unitKg ? String(Math.round(Number(count) * Number(unitKg) * 100) / 100) : direct;
  if (!kg) return { status: "error", message: "Indiquez la quantité récoltée." };
  const unitLabel = count && unitKg ? `${text(form, "unit_name") || "unité"} de ${unitKg} kg` : "";
  const { error, response } = await ctx.api.POST("/api/v1/crop-cycles/{id}/harvests/", {
    params: { header: ctx.header, path: { id } },
    body: {
      harvest_date: date,
      quantity_kg: kg,
      original_quantity: count && unitKg ? count : null,
      original_unit: unitLabel.slice(0, 20),
      measurement_method: (text(form, "measurement_method") || "declared") as "declared",
      harvested_area_m2: optionalNumber(form, "harvested_area_m2"),
      notes: text(form, "notes"),
    },
  });
  if (!response.ok) return { status: "error", message: forbidden(response.status) ?? apiErrorMessage(error) };
  revalidatePath(`/cycles/${id}`);
  return { status: "done" };
}
