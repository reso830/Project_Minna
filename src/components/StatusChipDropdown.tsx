"use client";

import { useId, useState } from "react";

import type { WorkItemState } from "../core/types";
import { ChevronIcon } from "./icons";

interface StatusChipDropdownProps {
  state: WorkItemState;
  onPause: () => void;
  onClose: () => void;
  disabled?: boolean;
}

export function StatusChipDropdown({ state, onPause, onClose, disabled = false }: StatusChipDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  if (state === "closed") {
    return <span className="journal-status journal-status--closed">closed</span>;
  }

  const canPause = state === "active" || state === "blocked";
  const closeMenu = () => setIsOpen(false);
  const runAction = (action: () => void) => {
    if (disabled) return;
    closeMenu();
    action();
  };
  return (
    <div
      className="journal-status-menu"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closeMenu();
      }}
      onFocusCapture={() => !disabled && setIsOpen(true)}
      onMouseEnter={() => !disabled && setIsOpen(true)}
      onMouseLeave={closeMenu}
    >
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Status: ${state}`}
        className={`journal-status journal-status--${state}`}
        disabled={disabled}
        onClick={() => setIsOpen(current => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            closeMenu();
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsOpen(current => !current);
          }
        }}
        type="button"
      >
        {state}<ChevronIcon direction="down" />
      </button>
      {isOpen && (
        <div aria-label="State actions" className="journal-status-dropdown" id={menuId} role="menu">
          {canPause && <button disabled={disabled} onClick={() => runAction(onPause)} type="button">Pause</button>}
          <button disabled={disabled} onClick={() => runAction(onClose)} type="button">Close</button>
        </div>
      )}
    </div>
  );
}
