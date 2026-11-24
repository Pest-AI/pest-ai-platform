"use client";

import { FileUp, LoaderCircle, Upload, X } from "lucide-react";
import { useActionState, useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { IMPORT_ACCEPT, checkFile, formatBytes } from "@/lib/parcel-imports";
import { cn } from "@/lib/utils";

import { type ImportState, uploadParcelFile } from "./actions";

/** Dépôt du fichier : glisser-déposer ou parcourir, contrôle immédiat, puis aperçu. */
export function UploadForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(uploadParcelFile, { status: "idle" });
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const problem = file ? checkFile(file) : null;

  const choose = (files: FileList | null) => {
    const picked = files?.[0] ?? null;
    setFile(picked);
    if (picked && input.current && input.current.files !== files && files) input.current.files = files;
  };

  return (
    <form action={action} className="space-y-3">
      {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
      <label
        htmlFor="parcel-file"
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          choose(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          over ? "border-leaf bg-brand-50" : "border-line-strong bg-surface hover:border-leaf",
        )}
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-forest">
          <FileUp className="size-6" aria-hidden />
        </span>
        <span className="mt-3 font-display text-[16px] font-semibold">Déposez votre fichier ici</span>
        <span className="mt-1 text-[13px] text-muted">
          ou <span className="font-semibold text-brand-700 underline">parcourez votre ordinateur</span> · 10 Mo au plus
        </span>
        <input
          ref={input}
          id="parcel-file"
          name="file"
          type="file"
          accept={IMPORT_ACCEPT}
          className="sr-only"
          onChange={(e) => choose(e.currentTarget.files)}
        />
      </label>

      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold">{file.name}</p>
            <p className={cn("text-[12px]", problem ? "text-danger" : "text-muted")}>{problem ?? formatBytes(file.size)}</p>
          </div>
          <button
            type="button"
            aria-label="Retirer le fichier"
            onClick={() => {
              setFile(null);
              if (input.current) input.current.value = "";
            }}
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!file || Boolean(problem) || pending} className="h-10 rounded-xl">
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
          {pending ? "Lecture du fichier…" : "Lire le fichier"}
        </Button>
        <span className="text-[13px] text-muted">Rien n’est créé avant votre confirmation.</span>
      </div>
    </form>
  );
}
