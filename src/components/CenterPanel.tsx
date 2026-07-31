"use client";

import { useEffect, useRef, useState } from "react";

import type { WorkItem, WorkItemEvent } from "../core/types";
import { SendIcon } from "./icons";
import { useWorkspace } from "./WorkspaceProvider";

interface DecisionPrompt {
  id: string;
  options: string[];
}

function getDecisionPrompt(event: WorkItemEvent): DecisionPrompt | null {
  if (event.type !== "agent.question" || !event.payload || typeof event.payload !== "object") return null;

  const payload = event.payload as Record<string, unknown>;
  if (
    typeof payload.decision_id !== "string"
    || !Array.isArray(payload.options)
    || !payload.options.every((option) => typeof option === "string")
  ) {
    return null;
  }

  return { id: payload.decision_id, options: payload.options };
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";

  return `${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
}

function featureNumber(id: string): string {
  const number = id.split("-").at(-1) ?? id;
  return /^\d+$/.test(number) ? number.padStart(3, "0") : number;
}

function avatarInitial(actor: string): string {
  if (actor === "minna") return "M";
  if (actor === "claude") return "A1";
  if (actor.startsWith("agent-")) return `A${actor.slice("agent-".length)}`;
  return actor.slice(0, 1).toUpperCase();
}

function actorLabel(actor: string): string {
  return actor === "claude" ? "agent-1" : actor;
}

function assigneeLabel(feature: WorkItem): string {
  return feature.assignee ?? "unassigned";
}

export function CenterPanel() {
  const {
    activeFeatureId,
    events,
    features,
    resolvedDecisions,
    submitDecision,
    submitReply,
  } = useWorkspace();
  const [reply, setReply] = useState("");
  const timelineRef = useRef<HTMLDivElement>(null);
  const previousTimeline = useRef({ featureId: null as string | null, length: 0 });
  const activeFeature = features.find((feature) => feature.id === activeFeatureId) ?? null;
  const timeline = activeFeature ? events[activeFeature.id] ?? [] : [];

  useEffect(() => {
    const timelineElement = timelineRef.current;
    const previous = previousTimeline.current;
    if (timelineElement && previous.featureId === activeFeatureId && timeline.length > previous.length) {
      timelineElement.scrollTop = timelineElement.scrollHeight;
    } else if (timelineElement && previous.featureId !== activeFeatureId) {
      timelineElement.scrollTop = timelineElement.scrollHeight;
    }
    previousTimeline.current = { featureId: activeFeatureId, length: timeline.length };
  }, [activeFeatureId, timeline.length]);

  const sendReply = () => {
    if (!activeFeature || !reply.trim()) return;

    submitReply(activeFeature.id, reply);
    setReply("");
  };

  if (!activeFeature) {
    return (
      <section aria-label="Journal thread" className="center-panel center-panel--empty-selection">
        <div className="journal-empty-state">
          <h1>Select a feature</h1>
          <p>Choose a feature from the sidebar to view its journal.</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Journal thread" className="center-panel">
      <header className="journal-header">
        <div className="journal-title">
          <span className="journal-feature-id">{featureNumber(activeFeature.id)}</span>
          <h1>{activeFeature.title}</h1>
        </div>
        <div className="journal-header-actions">
          <span className={`journal-status journal-status--${activeFeature.state}`}>{activeFeature.state}</span>
          <button className="journal-tasks-button" type="button">Tasks</button>
        </div>
      </header>

      <section aria-label="Feature details" className="feature-details">
        <dl>
          <div><dt>ID</dt><dd>{featureNumber(activeFeature.id)}</dd></div>
          <div><dt>Title</dt><dd>{activeFeature.title}</dd></div>
          <div><dt>Description</dt><dd>{activeFeature.description}</dd></div>
          <div><dt>Type</dt><dd>{activeFeature.work_item_type}</dd></div>
          <div><dt>State</dt><dd>{activeFeature.state}</dd></div>
          <div><dt>Phase</dt><dd>{activeFeature.phase}</dd></div>
          <div><dt>Assignee</dt><dd>{assigneeLabel(activeFeature)}</dd></div>
        </dl>
        {activeFeature.feature_brief_missing && <p className="feature-brief-warning">Warning: Feature brief not found. Click edit to recreate or attach a new brief.</p>}
      </section>

      <div aria-label="Journal timeline" className="journal-timeline" ref={timelineRef}>
        {timeline.length === 0 ? (
          <div className="journal-empty-state">
            <h2>No journal activity yet</h2>
            <p>Send a reply to begin tracking this feature.</p>
          </div>
        ) : (
          timeline.map((event, index) => {
            const decision = getDecisionPrompt(event);
            const resolvedOption = decision ? resolvedDecisions[activeFeature.id]?.[decision.id] : undefined;

            return (
              <article className="journal-event" key={`${event.timestamp}-${index}-${event.type}`}>
                <span aria-hidden="true" className={`journal-avatar journal-avatar--${event.actor}`}>
                  {avatarInitial(event.actor)}
                </span>
                <div className="journal-event-content">
                  <div className="journal-event-meta">
                    <span>{actorLabel(event.actor)}</span>
                    <time dateTime={event.timestamp}> · {formatTime(event.timestamp)}</time>
                  </div>
                  <div className="journal-bubble">{event.summary}</div>
                  {decision && (
                    resolvedOption ? (
                      <span className="journal-decision-resolved">✓ {resolvedOption}</span>
                    ) : (
                      <div aria-label="Decision options" className="journal-decision-options">
                        {decision.options.map((option) => (
                          <button
                            key={option}
                            onClick={() => submitDecision(activeFeature.id, decision.id, option)}
                            type="button"
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      <footer className="journal-composer">
        <div className="journal-composer-row">
          <input
            aria-label={`Reply to ${activeFeature.title}`}
            onChange={(event) => setReply(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                sendReply();
              }
            }}
            placeholder="Send reply"
            value={reply}
          />
          <button aria-label="Send reply" className="journal-send-button" onClick={sendReply} type="button"><SendIcon /></button>
        </div>
        <span className="journal-git-info">{activeFeature.branch ? `(a1c9e42) ${activeFeature.branch}` : "No branch created"}</span>
      </footer>
    </section>
  );
}
