"use client";

import { useEffect, useRef } from "react";

interface ErrorModalProps {
  details: string;
  onDismiss: () => void;
}

export function ErrorModal({ details, onDismiss }: ErrorModalProps) {
  const dismissButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    dismissButton.current?.focus();
    const containFocus = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        dismissButton.current?.focus();
      }
    };
    document.addEventListener("keydown", containFocus);
    return () => document.removeEventListener("keydown", containFocus);
  }, []);

  return (
    <div className="error-modal-backdrop" data-testid="error-modal-backdrop">
      <section aria-label="Project validation failed" aria-modal="true" className="error-modal" role="dialog">
        <p className="error-modal-eyebrow">Project import blocked</p>
        <h2>Project validation failed</h2>
        <p className="error-modal-details">{details}</p>
        <button className="error-modal-dismiss" onClick={onDismiss} ref={dismissButton} type="button">Dismiss</button>
      </section>
    </div>
  );
}
