"use client";

import { useRef, useState } from "react";

import type { ClosedReason } from "../core/types";
import { useModalFocus } from "./useModalFocus";

export function CloseReasonModal({ title, onCancel, onConfirm, disabled = false }: { title: string; onCancel: () => void; onConfirm: (reason: ClosedReason) => void; disabled?: boolean }) {
  const [reason, setReason] = useState<ClosedReason>("done");
  const dialogRef = useRef<HTMLElement>(null);
  const doneRef = useRef<HTMLInputElement>(null);
  useModalFocus(dialogRef, doneRef);

  return (
    <div className="feature-modal-backdrop">
      <section aria-label={`Close ${title}?`} aria-modal="true" className="feature-confirm-modal close-reason-modal" ref={dialogRef} role="dialog">
        <h2>Close &quot;{title}&quot;?</h2>
        <p>Select the outcome to record for this work item.</p>
        <fieldset className="close-reason-options">
          <legend>Close reason</legend>
          {(["done", "dropped", "failed"] as const).map(option => (
            <label key={option}>
              <input checked={reason === option} disabled={disabled} name="closed-reason" onChange={() => setReason(option)} ref={option === "done" ? doneRef : undefined} type="radio" value={option} />
              {option[0].toUpperCase()}{option.slice(1)}
            </label>
          ))}
        </fieldset>
        <div className="feature-modal-actions">
          <span />
          <button onClick={onCancel} type="button">Cancel</button>
          <button disabled={disabled} onClick={() => onConfirm(reason)} type="button">Close</button>
        </div>
      </section>
    </div>
  );
}
