"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { ClosedReason, WorkItem, WorkItemEvent } from "../core/types";
import { InfoIcon, PinIcon, SendIcon } from "./icons";
import { CloseReasonModal } from "./CloseReasonModal";
import { QuickPhrasesBar } from "./QuickPhrasesBar";
import { StatusChipDropdown } from "./StatusChipDropdown";
import { useWorkspace, type QuickPhraseEcho } from "./WorkspaceProvider";

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

function isQuickPhraseEcho(event: WorkItemEvent | QuickPhraseEcho): event is QuickPhraseEcho {
  return "kind" in event && event.kind === "quick_phrase_echo";
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
  return feature.assignee?.trim() || "Minna";
}

const agentAvatars: Record<string, { code: string; color: string }> = {
  agy: { code: "A3", color: "#c0392b" },
  claude: { code: "A1", color: "#e08a2e" },
  codex: { code: "A2", color: "#4a544d" },
};

function AssigneeAvatar({ feature }: { feature: WorkItem }) {
  const assignee = feature.assignee?.trim();
  if (!assignee || assignee.toLowerCase() === "minna") {
    return (
      <div aria-label="Assignee: Minna" className="journal-assignee-avatar journal-assignee-avatar--minna" role="img">
        <Image alt="" aria-hidden="true" height={26} src="/assets/Minna_White.png" width={26} />
      </div>
    );
  }

  const avatar = agentAvatars[assignee.toLowerCase()] ?? {
    code: assignee.slice(0, 2).toUpperCase(),
    color: "#4a544d",
  };

  return (
    <span aria-label={`Assignee: ${assignee}`} className="journal-assignee-avatar journal-assignee-avatar--agent" role="img" style={{ backgroundColor: avatar.color }}>
      {avatar.code}
    </span>
  );
}

export function CenterPanel() {
  const {
    activeFeatureId,
    events,
    quickPhraseEchoes,
    features,
    resolvedDecisions,
    submitDecision,
    submitReply,
    appendQuickPhraseEcho,
    transitionFeatureState,
  } = useWorkspace();
  const [reply, setReply] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isCloseReasonOpen, setIsCloseReasonOpen] = useState(false);
  const [isTransitionPending, setIsTransitionPending] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isAtBottomRef = useRef(true);
  const previousTimeline = useRef({ featureId: null as string | null, length: 0 });
  const activeFeature = features.find((feature) => feature.id === activeFeatureId) ?? null;
  const timeline = activeFeature
    ? [...(events[activeFeature.id] ?? []), ...(quickPhraseEchoes?.[activeFeature.id] ?? [])].sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    : [];
  const isDetailsVisible = isPinned || isHovered;

  const captureScrollState = () => {
    const timelineElement = timelineRef.current;
    if (timelineElement) {
      isAtBottomRef.current = timelineElement.scrollTop + timelineElement.clientHeight >= timelineElement.scrollHeight - 5;
    }
  };

  const clearLeaveTimeout = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  };

  const showDetails = () => {
    captureScrollState();
    clearLeaveTimeout();
    setIsHovered(true);
  };

  const scheduleDetailsClose = () => {
    clearLeaveTimeout();
    leaveTimeoutRef.current = setTimeout(() => {
      captureScrollState();
      setIsHovered(false);
      leaveTimeoutRef.current = null;
    }, 150);
  };

  const toggleDetailsPin = () => {
    captureScrollState();
    clearLeaveTimeout();
    if (isPinned) {
      setIsPinned(false);
      setIsHovered(false);
      return;
    }

    setIsPinned(true);
  };

  useEffect(() => () => clearLeaveTimeout(), []);

  useEffect(() => {
    captureScrollState();
    clearLeaveTimeout();
    setIsPinned(false);
    setIsHovered(false);
  }, [activeFeatureId]);

  useLayoutEffect(() => {
    const timelineElement = timelineRef.current;
    if (timelineElement && isAtBottomRef.current) {
      timelineElement.scrollTop = timelineElement.scrollHeight;
    }
  }, [isDetailsVisible]);

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

  const performTransition = async (nextState: WorkItem["state"], closedReason?: ClosedReason): Promise<boolean> => {
    if (isTransitionPending) return false;
    setIsTransitionPending(true);
    try {
      return await transitionFeatureState(activeFeatureId!, nextState, closedReason);
    } finally {
      setIsTransitionPending(false);
    }
  };

  const startFeature = async () => {
    if (!activeFeature) return;

    const featureId = activeFeature.id;
    if (await performTransition("active")) {
      appendQuickPhraseEcho(featureId, "Start this feature.");
    }
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
        <AssigneeAvatar feature={activeFeature} />
        <div className="journal-title">
          <span className="journal-feature-id">{featureNumber(activeFeature.id)}</span>
          <h1>{activeFeature.title}</h1>
        </div>
        <div className="journal-header-actions">
          <StatusChipDropdown
            disabled={isTransitionPending}
            onClose={() => !isTransitionPending && setIsCloseReasonOpen(true)}
            onPause={() => void performTransition("parked")}
            state={activeFeature.state}
          />
          <button className="journal-tasks-button" type="button">Tasks</button>
          <button
            aria-label="Show details"
            aria-pressed={isPinned}
            className={`journal-details-toggle${isDetailsVisible ? " journal-details-toggle--active" : ""}`}
            onClick={toggleDetailsPin}
            onMouseEnter={showDetails}
            onMouseLeave={scheduleDetailsClose}
            type="button"
          >
            {isDetailsVisible ? <PinIcon /> : <InfoIcon />}
          </button>
        </div>
      </header>

      {activeFeature.feature_brief_missing && (
        <p className="feature-brief-warning" onMouseEnter={showDetails} onMouseLeave={scheduleDetailsClose}>
          Warning: Feature brief not found. Click edit to recreate or attach a new brief.
        </p>
      )}

      {isDetailsVisible && (
        <section aria-label="Feature details" className="details-panel" onMouseEnter={showDetails} onMouseLeave={scheduleDetailsClose}>
          <div className="details-panel-row">
            <div className="details-panel-col"><span className="details-panel-label">ID</span><span className="details-panel-value">{featureNumber(activeFeature.id)}</span></div>
            <div className="details-panel-col"><span className="details-panel-label">Title</span><span className="details-panel-value">{activeFeature.title}</span></div>
          </div>
          <div className="details-panel-row">
            <div className="details-panel-col"><span className="details-panel-label">Type</span><span className="details-panel-value">{activeFeature.work_item_type}</span></div>
            <div className="details-panel-col"><span className="details-panel-label">Assignee</span><span className="details-panel-value">{assigneeLabel(activeFeature)}</span></div>
          </div>
          <div className="details-panel-col"><span className="details-panel-label">Description</span><span className="details-panel-value">{activeFeature.description}</span></div>
        </section>
      )}

      <div aria-label="Journal timeline" className="journal-timeline" onScroll={captureScrollState} ref={timelineRef}>
        {timeline.length === 0 ? (
          <div className="journal-empty-state">
            <h2>No journal activity yet</h2>
            <p>Send a reply to begin tracking this feature.</p>
          </div>
        ) : (
          timeline.map((event, index) => {
            const decision = isQuickPhraseEcho(event) ? null : getDecisionPrompt(event);
            const resolvedOption = decision ? resolvedDecisions[activeFeature.id]?.[decision.id] : undefined;

            return (
              <article className="journal-event" key={`${event.timestamp}-${index}-${isQuickPhraseEcho(event) ? event.kind : event.type}`}>
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

      {activeFeature.state === "parked" && (
        <QuickPhrasesBar disabled={isTransitionPending} phrases={["Start this feature."]} onSelect={() => void startFeature()} />
      )}

      <footer className={`journal-composer${activeFeature.state === "parked" ? " journal-composer--with-quick-phrases" : ""}`}>
        <div className="journal-composer-row">
          <textarea
            aria-label={`Reply to ${activeFeature.title}`}
            onChange={(event) => setReply(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendReply();
              }
            }}
            placeholder="Send reply"
            rows={2}
            value={reply}
          />
          <button aria-label="Send reply" className="journal-send-button" onClick={sendReply} type="button"><SendIcon size={24} /></button>
        </div>
        <span className="journal-git-info">{activeFeature.branch ? `(a1c9e42) ${activeFeature.branch}` : "No branch created"}</span>
      </footer>
      {isCloseReasonOpen && (
        <CloseReasonModal
          disabled={isTransitionPending}
          onCancel={() => setIsCloseReasonOpen(false)}
          onConfirm={async (reason: ClosedReason) => {
            if (await performTransition("closed", reason)) setIsCloseReasonOpen(false);
          }}
          title={activeFeature.title}
        />
      )}
    </section>
  );
}
