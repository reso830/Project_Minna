"use client";

import { useRef } from "react";

import { useModalFocus } from "./useModalFocus";

export function DropConfirmModal({ title, onCancel, onDrop }: { title: string; onCancel: () => void; onDrop: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useModalFocus(dialogRef, cancelRef);
  return (
    <div className="feature-modal-backdrop">
      <section aria-label={`Drop ${title}?`} aria-modal="true" className="feature-confirm-modal feature-confirm-modal--drop" ref={dialogRef} role="dialog">
        <h2>Drop &quot;{title}&quot;?</h2>
        <p>This drops/archives the feature. This action will change its state to closed and closed_reason to dropped. It does not delete the feature or its event history.</p>
        <div className="feature-modal-actions">
          <span />
          <button onClick={onCancel} ref={cancelRef} type="button">Cancel</button>
          <button className="feature-button--danger" onClick={onDrop} type="button">Drop Feature</button>
        </div>
      </section>
    </div>
  );
}
