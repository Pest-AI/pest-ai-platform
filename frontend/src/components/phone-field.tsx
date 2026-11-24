"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { COUNTRIES } from "@/lib/countries";
import { DEFAULT_COUNTRY, findCountry, flag, lengthHint, splitPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

/**
 * Numéro de téléphone avec choix du pays (drapeau + indicatif), Sénégal par défaut.
 * Envoie deux champs : `<countryName>` (code ISO) et `<name>` (numéro national ou
 * international). Le serveur compose le numéro E.164 (lib/phone) : le formulaire marche
 * aussi avant le chargement des scripts.
 */
export function PhoneField({
  id,
  name = "phone_number",
  countryName = "phone_country",
  defaultValue,
  required,
  autoComplete = "tel",
  large = false,
  label = "Numéro de téléphone",
}: {
  id: string;
  name?: string;
  countryName?: string;
  defaultValue?: string;
  required?: boolean;
  autoComplete?: string;
  large?: boolean;
  label?: string;
}) {
  const initial = defaultValue?.startsWith("+") ? splitPhone(defaultValue) : null;
  const [iso, setIso] = useState(initial?.country.iso ?? DEFAULT_COUNTRY);
  const [value, setValue] = useState(initial ? initial.national : (defaultValue ?? ""));
  const country = findCountry(iso);
  const hint = lengthHint(country, value);
  const hintId = useId();
  const countryId = `${id}-country`;

  return (
    <div>
      <div
        className={cn(
          "flex w-full items-center rounded-lg border border-field bg-canvas text-[15px] text-ink transition-colors focus-within:border-brand-800 focus-within:ring-3 focus-within:ring-gold/35",
          large ? "h-[52px] rounded-xl border-line-strong" : "h-11",
        )}
      >
        <label htmlFor={countryId} className="sr-only">
          Pays
        </label>
        <span className="relative flex h-full shrink-0 items-center rounded-l-lg border-r border-line bg-surface">
          <span aria-hidden className="pointer-events-none flex items-center gap-1.5 pr-7 pl-3 text-[14px] font-medium">
            <span className="text-[18px] leading-none">{flag(country.iso)}</span>+{country.dial}
          </span>
          <ChevronDown aria-hidden className="pointer-events-none absolute right-2 size-3.5 text-muted" />
          <select
            id={countryId}
            name={countryName}
            value={iso}
            onChange={(e) => setIso(e.currentTarget.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            title={`${country.name} (+${country.dial})`}
          >
            {COUNTRIES.map((c) => (
              <option key={c.iso} value={c.iso}>
                {flag(c.iso)} {c.name} (+{c.dial})
              </option>
            ))}
          </select>
        </span>
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <input
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          required={required}
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          placeholder={country.iso === "SN" ? "77 123 45 67" : country.length ? `${country.length} chiffres` : "Numéro"}
          aria-describedby={hint ? hintId : undefined}
          className="h-full min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-muted"
        />
      </div>
      {hint ? (
        <p id={hintId} className="mt-1 text-[12px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
