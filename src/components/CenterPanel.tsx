"use client";

import { useEffect, useRef, useState } from "react";

import type { WorkItemEvent } from "../core/types";
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

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function featureNumber(id: string): string {
  return id.split("-").at(-1) ?? id;
}

function avatarInitial(actor: string): string {
  return actor === "minna" ? "M" : actor.slice(0, 1).toUpperCase();
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
  const activeFeature = features.find((feature) => feature.id === activeFeatureId) ?? null;
  const timeline = activeFeature ? events[activeFeature.id] ?? [] : [];

  useEffect(() => {
    const timelineElement = timelineRef.current;
    if (timelineElement) {
      timelineElement.scrollTop = timelineElement.scrollHeight;
    }
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
                    <span>{event.actor}</span>
                    <time dateTime={event.timestamp}>{formatTime(event.timestamp)}</time>
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
            placeholder="Write a reply..."
            value={reply}
          />
          <button aria-label="Send reply" className="journal-send-button" onClick={sendReply} type="button">↑</button>
        </div>
        <span className="journal-git-info">{activeFeature.branch ?? "No branch created"}</span>
      </footer>
    </section>
  );
}
