"use client";

import { useEffect, useState } from "react";

import { ChevronIcon } from "./icons";

const usage = [
  { id: "agent-1", color: "#e08a2e", fiveHours: 40, sevenDays: 72 },
  { id: "agent-2", color: "#4a544d", fiveHours: 15, sevenDays: 48 },
  { id: "agent-3", color: "#c0392b", fiveHours: 5, sevenDays: 30 },
];

const storageKey = "minna_agent_usage_expanded";

export function AgentUsage() {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    setExpanded(window.sessionStorage.getItem(storageKey) !== "false");
  }, []);

  const toggle = () => {
    setExpanded((current) => {
      const next = !current;
      window.sessionStorage.setItem(storageKey, String(next));
      return next;
    });
  };

  return (
    <section className="agent-usage">
      <button
        aria-expanded={expanded}
        className="agent-usage-toggle"
        onClick={toggle}
        type="button"
      >
        <span>Agent usage</span>
        <span aria-hidden="true" className="sidebar-chevron"><ChevronIcon direction={expanded ? "down" : "right"} /></span>
      </button>
      {expanded && (
        <div className="agent-usage-list">
          {usage.map((agent) => (
            <div className="agent-usage-row" key={agent.id}>
              <span aria-label={`${agent.id} usage`} className="agent-swatch" style={{ backgroundColor: agent.color }} />
              <div className="agent-usage-meters">
                <UsageMeter label="5h" value={agent.fiveHours} />
                <UsageMeter label="7d" value={agent.sevenDays} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function UsageMeter({ label, value }: { label: "5h" | "7d"; value: number }) {
  return (
    <div className="usage-meter">
      <span>{label}</span>
      <span aria-label={`${label} usage: ${value}%`} className="usage-meter-track">
        <span className="usage-meter-value" style={{ width: `${value}%` }} />
      </span>
    </div>
  );
}
