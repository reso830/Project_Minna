"use client";

import { useEffect, type RefObject } from "react";

export function useModalFocus(dialogRef: RefObject<HTMLElement | null>, initialFocusRef: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    initialFocusRef.current?.focus();
    const containFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)") ?? []);
      if (focusable.length === 0) return;
      event.preventDefault();
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
        : (currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1);
      focusable[nextIndex]?.focus();
    };
    document.addEventListener("keydown", containFocus);
    return () => document.removeEventListener("keydown", containFocus);
  }, [dialogRef, enabled, initialFocusRef]);
}
