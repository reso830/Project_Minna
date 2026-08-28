"use client";

import { useEffect, useRef, useState } from "react";

import { ChevronIcon } from "./icons";

interface QuickPhrasesBarProps {
  disabled?: boolean;
  phrases: string[];
  onSelect: (phrase: string) => void;
}

export function QuickPhrasesBar({ disabled = false, phrases, onSelect }: QuickPhrasesBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollAvailability = () => {
    const container = scrollRef.current;
    if (!container) return;

    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(container.scrollLeft + container.clientWidth < container.scrollWidth - 1);
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    container.scrollLeft = 0;
    updateScrollAvailability();
    window.addEventListener("resize", updateScrollAvailability);
    return () => window.removeEventListener("resize", updateScrollAvailability);
  }, [phrases]);

  const scrollToPhrase = (direction: "left" | "right") => {
    const container = scrollRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const phraseButtons = Array.from(container.querySelectorAll<HTMLButtonElement>(".quick-phrases-chip"));
    const currentLeft = container.scrollLeft;
    const target = direction === "right"
      ? phraseButtons.find((button) => button.getBoundingClientRect().right > containerRect.right + 1)
      : [...phraseButtons].reverse().find((button) => button.getBoundingClientRect().left < containerRect.left - 1);

    if (target) {
      const targetRect = target.getBoundingClientRect();
      const offset = direction === "right"
        ? targetRect.left - containerRect.left + currentLeft
        : targetRect.right - containerRect.right + currentLeft;
      container.scrollTo({ behavior: "smooth", left: Math.max(0, offset) });
    }
  };

  return (
    <div className="quick-phrases-bar">
      {canScrollLeft && (
        <button aria-label="Scroll quick phrases left" className="quick-phrases-scroll quick-phrases-scroll--left" onClick={() => scrollToPhrase("left")} type="button">
          <ChevronIcon direction="right" />
        </button>
      )}
      <div aria-label="Quick phrases" className="quick-phrases-list" onScroll={updateScrollAvailability} ref={scrollRef}>
        {phrases.map((phrase) => (
          <button className="quick-phrases-chip" disabled={disabled} key={phrase} onClick={() => onSelect(phrase)} type="button">
            {phrase}
          </button>
        ))}
      </div>
      {canScrollRight && (
        <button aria-label="Scroll quick phrases right" className="quick-phrases-scroll" onClick={() => scrollToPhrase("right")} type="button">
          <ChevronIcon direction="right" />
        </button>
      )}
    </div>
  );
}
