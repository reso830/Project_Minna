"use client";

import { mockAgentLogs, mockDiffs, mockPlanMarkdown } from "../core/mockData";
import { useWorkspace } from "./WorkspaceProvider";

const tabs = [
  { id: "agents", label: "AGENTS" },
  { id: "md", label: "MD" },
  { id: "diff", label: "DIFF" },
] as const;

function AgentView({ featureId, state }: { featureId: string; state: string }) {
  const { expandedAgents, toggleAgent } = useWorkspace();
  const agentId = `${featureId}-agent-1`;
  const expanded = expandedAgents[agentId] ?? false;
  const logs = mockAgentLogs[featureId] ?? [];
  const status = state === "active" ? "working" : "idle";

  if (logs.length === 0) {
    return <p className="detail-empty">No agent log available.</p>;
  }

  return (
    <section className="agent-pane">
      <button
        aria-expanded={expanded}
        className="agent-pane-toggle"
        onClick={() => toggleAgent(agentId)}
        type="button"
      >
        <span aria-hidden="true">{expanded ? "⌄" : "›"}</span>
        <span>agent-1 · <strong className={`agent-status agent-status--${status}`}>{status}</strong></span>
      </button>
      {expanded && (
        <pre className="agent-terminal">
          {logs.map((line, index) => <code className={line.startsWith("$") ? "terminal-command" : "terminal-output"} key={`${agentId}-${index}`}>{line}</code>)}
        </pre>
      )}
    </section>
  );
}

function MarkdownView({ featureId }: { featureId: string }) {
  const markdown = mockPlanMarkdown[featureId];
  if (!markdown) return <p className="detail-empty">No plan markdown available.</p>;

  const [heading, ...body] = markdown.split("\n").filter(Boolean);
  const bullets = body.filter((line) => line.startsWith("- "));

  return (
    <article className="detail-markdown">
      <h2>{heading.replace(/^#\s*/, "")}</h2>
      <ul>{bullets.map((line, index) => <li key={`${featureId}-${index}`}>{line.slice(2)}</li>)}</ul>
    </article>
  );
}

function DiffView({ featureId }: { featureId: string }) {
  const diff = mockDiffs[featureId];
  if (!diff) return <p className="detail-empty">No diff available.</p>;

  return (
    <pre className="detail-diff">
      {diff.split("\n").map((line, index) => (
        <code
          className={line.startsWith("@@") ? "diff-hunk" : line.startsWith("+") ? "diff-addition" : line.startsWith("-") ? "diff-removal" : "diff-context"}
          key={`${featureId}-${index}`}
        >
          {line}
        </code>
      ))}
    </pre>
  );
}

export function RightPanel() {
  const { activeFeatureId, activeRightTab, features, setRightTab } = useWorkspace();
  const activeFeature = features.find((feature) => feature.id === activeFeatureId) ?? null;

  return (
    <section aria-label="Detail panel" className="right-panel">
      <div aria-label="Detail views" className="detail-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            aria-controls={`details-${tab.id}`}
            aria-selected={activeRightTab === tab.id}
            className="detail-tab"
            id={`details-tab-${tab.id}`}
            key={tab.id}
            onClick={() => setRightTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        aria-labelledby={`details-tab-${activeRightTab}`}
        className="detail-content"
        id={`details-${activeRightTab}`}
        role="tabpanel"
      >
        {!activeFeature ? (
          <p className="detail-empty">Select a feature to inspect its details.</p>
        ) : activeRightTab === "agents" ? (
          <AgentView featureId={activeFeature.id} state={activeFeature.state} />
        ) : activeRightTab === "md" ? (
          <MarkdownView featureId={activeFeature.id} />
        ) : (
          <DiffView featureId={activeFeature.id} />
        )}
      </div>
    </section>
  );
}
