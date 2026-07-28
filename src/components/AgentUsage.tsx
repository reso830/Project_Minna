"use client";

import { useEffect, useState } from "react";

const usage = [
  { id: "claude", name: "Claude", color: "#f29f67", fiveHours: 78, sevenDays: 61 },
  { id: "codex", name: "Codex", color: "#00c9d6", fiveHours: 52, sevenDays: 43 },
  { id: "human", name: "Human", color: "#8f9a94", fiveHours: 24, sevenDays: 18 },
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
        <span aria-hidden="true" className="sidebar-chevron">{expanded ? "⌄" : "›"}</span>
      </button>
      {expanded && (
        <div className="agent-usage-list">
          {usage.map((agent) => (
            <div className="agent-usage-row" key={agent.id}>
              <div className="agent-usage-name">
                <span aria-hidden="true" className="agent-swatch" style={{ backgroundColor: agent.color }} />
                {agent.name}
              </div>
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
