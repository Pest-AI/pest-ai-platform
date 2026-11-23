"use client";

import type * as React from "react";

/** Liste déroulante de filtre : soumet son formulaire dès qu'on change la valeur. */
export function AutoSubmitSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: [string, string][];
}) {
  return (
    <label className="relative inline-flex">
      <span className="sr-only">{label}</span>
      <select
        name={name}
        defaultValue={value}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => e.currentTarget.form?.requestSubmit()}
        className="h-9 cursor-pointer appearance-none rounded-xl border border-line bg-surface pr-8 pl-3 text-[13px] font-medium text-ink transition-colors hover:border-line-strong focus:border-leaf focus:outline-none"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
      <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted">
        <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}
