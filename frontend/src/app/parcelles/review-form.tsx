"use client";

import { Check, X } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { type ReviewState, reviewGeometry } from "./actions";

/** Trancher un contour signalé : confirmer, ou refuser avec un motif. */
export function ReviewForm({ parcelId, geometryId }: { parcelId: string; geometryId: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(reviewGeometry, { status: "idle" });
  const [rejecting, setRejecting] = useState(false);
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="parcel_id" value={parcelId} />
      <input type="hidden" name="geometry_id" value={geometryId} />
      {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
      {rejecting ? (
        <>
          <label htmlFor="review-note" className="block text-[13px] font-semibold">
            Motif du refus
          </label>
          <textarea
            id="review-note"
            name="note"
            required
            rows={2}
            placeholder="Ex. contour relevé sur la parcelle voisine"
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[14px] focus:border-leaf focus:outline-none"
          />
          <div className="flex gap-2">
            <Button type="submit" name="decision" value="rejected" variant="danger" disabled={pending}>
              Refuser le contour
            </Button>
            <Button type="button" variant="ghost" onClick={() => setRejecting(false)}>
              Annuler
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="decision" value="valid" disabled={pending}>
            <Check aria-hidden />
            Confirmer le contour
          </Button>
          <Button type="button" variant="secondary" onClick={() => setRejecting(true)}>
            <X aria-hidden />
            Refuser…
          </Button>
        </div>
      )}
    </form>
  );
}
