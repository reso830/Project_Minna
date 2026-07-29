"use client";

import { useRef } from "react";

import { useModalFocus } from "./useModalFocus";

interface RemoveConfirmModalProps {
  name: string;
  onCancel: () => void;
  onRemove: () => void;
}

export function RemoveConfirmModal({ name, onCancel, onRemove }: RemoveConfirmModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  useModalFocus(dialogRef, cancelButtonRef);

  return (
    <div className="project-modal-backdrop">
      <section aria-label={`Remove ${name}`} aria-modal="true" className="project-modal" ref={dialogRef} role="dialog">
        <h2>Remove &quot;{name}&quot;?</h2>
        <p>This removes the project from Minna. Your project files on disk won&apos;t be affected.</p>
        <div className="project-modal-actions project-modal-actions--end">
          <button onClick={onCancel} ref={cancelButtonRef} type="button">Cancel</button>
          <button className="project-modal-button--danger" onClick={onRemove} type="button">Remove Project</button>
        </div>
      </section>
    </div>
  );
}
