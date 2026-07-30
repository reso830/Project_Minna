"use client";

import { useRef } from "react";

import { useModalFocus } from "./useModalFocus";

interface DiscardConfirmModalProps {
  onDiscard: () => void;
  onKeepEditing: () => void;
}

export function DiscardConfirmModal({ onDiscard, onKeepEditing }: DiscardConfirmModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const keepEditingButtonRef = useRef<HTMLButtonElement>(null);
  useModalFocus(dialogRef, keepEditingButtonRef);

  return (
    <div className="project-modal-backdrop">
      <section aria-label="Discard project changes" aria-modal="true" className="project-modal" ref={dialogRef} role="dialog">
        <h2>Discard changes?</h2>
        <p>You have unsaved changes to this project. Discard them?</p>
        <div className="project-modal-actions project-modal-actions--end">
          <button onClick={onKeepEditing} ref={keepEditingButtonRef} type="button">Keep Editing</button>
          <button className="project-modal-button--danger" onClick={onDiscard} type="button">Discard</button>
        </div>
      </section>
    </div>
  );
}
