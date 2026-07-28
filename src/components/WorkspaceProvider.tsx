"use client";

import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { mockEvents, mockFeatures } from "../core/mockData";
import type { WorkItem, WorkItemEvent } from "../core/types";

type RightTab = "agents" | "md" | "diff";
type WorkspaceView = "journal" | "board";

interface WorkspaceContextValue {
  activeFeatureId: string | null;
  activeRightTab: RightTab;
  activeView: WorkspaceView;
  expandedProjects: Record<string, boolean>;
  expandedAgents: Record<string, boolean>;
  features: WorkItem[];
  events: Record<string, WorkItemEvent[]>;
  resolvedDecisions: Record<string, Record<string, string>>;
  selectFeature: (featureId: string) => void;
  setRightTab: (tab: RightTab) => void;
  toggleWorkspaceView: () => void;
  toggleProject: (projectName: string) => void;
  toggleAgent: (agentId: string) => void;
  submitReply: (featureId: string, text: string) => void;
  submitDecision: (featureId: string, decisionId: string, option: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const defaultFeatureId = mockFeatures[0]?.id ?? null;
const defaultProjectName = mockFeatures[0]?.project;
const defaultExpandedProjects = defaultProjectName ? { [defaultProjectName]: true } : {};
const defaultExpandedAgents = defaultFeatureId ? { [`${defaultFeatureId}-agent-1`]: true } : {};

const cloneEvents = (): Record<string, WorkItemEvent[]> =>
  Object.fromEntries(Object.entries(mockEvents).map(([featureId, events]) => [featureId, [...events]]));

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const stored = window.sessionStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
};

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const [activeFeatureId, setActiveFeatureId] = useState<string | null>(defaultFeatureId);
  const [activeRightTab, setActiveRightTab] = useState<RightTab>("agents");
  const [activeView, setActiveView] = useState<WorkspaceView>("journal");
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>(defaultExpandedProjects);
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>(defaultExpandedAgents);
  const [features, setFeatures] = useState<WorkItem[]>(() => [...mockFeatures]);
  const [events, setEvents] = useState<Record<string, WorkItemEvent[]>>(cloneEvents);
  const [resolvedDecisions, setResolvedDecisions] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    const storedFeatureId = window.sessionStorage.getItem("minna_active_feature_id");
    if (storedFeatureId && mockFeatures.some((feature) => feature.id === storedFeatureId)) {
      setActiveFeatureId(storedFeatureId);
    }

    const storedTab = window.sessionStorage.getItem("minna_active_right_tab");
    if (storedTab === "agents" || storedTab === "md" || storedTab === "diff") {
      setActiveRightTab(storedTab);
    }

    const projectState = Object.fromEntries(
      [...new Set(mockFeatures.map((feature) => feature.project))].map((project) => [
        project,
        readJson(`minna_project_expanded_${project}`, project === defaultProjectName),
      ]),
    );
    setExpandedProjects(projectState);

    const agentState: Record<string, boolean> = { ...defaultExpandedAgents };
    for (const key of Array.from({ length: window.sessionStorage.length }, (_, index) => window.sessionStorage.key(index))) {
      if (key?.startsWith("minna_agent_expanded_")) {
        agentState[key.slice("minna_agent_expanded_".length)] = readJson(key, false);
      }
    }
    setExpandedAgents(agentState);

    const replyEvents = cloneEvents();
    const decisions: Record<string, Record<string, string>> = {};
    for (const feature of mockFeatures) {
      replyEvents[feature.id] = [...replyEvents[feature.id], ...readJson<WorkItemEvent[]>(`minna_replies_${feature.id}`, [])];
      const featureDecisions = readJson<Record<string, string>>(`minna_decisions_${feature.id}`, {});
      if (Object.keys(featureDecisions).length > 0) {
        decisions[feature.id] = featureDecisions;
      }
    }
    setEvents(replyEvents);
    setResolvedDecisions(decisions);
    setFeatures((currentFeatures) =>
      currentFeatures.map((feature) =>
        decisions[feature.id]
          ? { ...feature, state: "active", blocked_reason: null }
          : feature,
      ),
    );
  }, []);

  const value = useMemo<WorkspaceContextValue>(() => ({
    activeFeatureId,
    activeRightTab,
    activeView,
    expandedProjects,
    expandedAgents,
    features,
    events,
    resolvedDecisions,
    selectFeature: (featureId) => {
      setActiveFeatureId(featureId);
      setActiveView("journal");
      window.sessionStorage.setItem("minna_active_feature_id", featureId);
    },
    setRightTab: (tab) => {
      setActiveRightTab(tab);
      window.sessionStorage.setItem("minna_active_right_tab", tab);
    },
    toggleWorkspaceView: () => {
      setActiveView((current) => current === "board" ? "journal" : "board");
    },
    toggleProject: (projectName) => {
      setExpandedProjects((current) => {
        const next = { ...current, [projectName]: !current[projectName] };
        window.sessionStorage.setItem(`minna_project_expanded_${projectName}`, JSON.stringify(next[projectName]));
        return next;
      });
    },
    toggleAgent: (agentId) => {
      setExpandedAgents((current) => {
        const next = { ...current, [agentId]: !current[agentId] };
        window.sessionStorage.setItem(`minna_agent_expanded_${agentId}`, JSON.stringify(next[agentId]));
        return next;
      });
    },
    submitReply: (featureId, text) => {
      const summary = text.trim();
      if (!summary) return;

      const reply: WorkItemEvent = {
        work_item_id: featureId,
        timestamp: new Date().toISOString(),
        actor: "human",
        type: "human.message",
        summary,
        artifact_path: null,
        payload: {},
      };
      setEvents((current) => ({ ...current, [featureId]: [...(current[featureId] ?? []), reply] }));
      const replies = readJson<WorkItemEvent[]>(`minna_replies_${featureId}`, []);
      window.sessionStorage.setItem(`minna_replies_${featureId}`, JSON.stringify([...replies, reply]));
    },
    submitDecision: (featureId, decisionId, option) => {
      const confirmation: WorkItemEvent = {
        work_item_id: featureId,
        timestamp: new Date().toISOString(),
        actor: "human",
        type: "human.decided",
        summary: option,
        artifact_path: null,
        payload: { decision_id: decisionId, option },
      };
      setResolvedDecisions((current) => {
        const next = { ...current, [featureId]: { ...current[featureId], [decisionId]: option } };
        window.sessionStorage.setItem(`minna_decisions_${featureId}`, JSON.stringify(next[featureId]));
        return next;
      });
      setFeatures((current) =>
        current.map((feature) =>
          feature.id === featureId ? { ...feature, state: "active", blocked_reason: null } : feature,
        ),
      );
      setEvents((current) => ({
        ...current,
        [featureId]: [...(current[featureId] ?? []), confirmation],
      }));
      const replies = readJson<WorkItemEvent[]>(`minna_replies_${featureId}`, []);
      window.sessionStorage.setItem(`minna_replies_${featureId}`, JSON.stringify([...replies, confirmation]));
    },
  }), [activeFeatureId, activeRightTab, activeView, events, expandedAgents, expandedProjects, features, resolvedDecisions]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return workspace;
}
