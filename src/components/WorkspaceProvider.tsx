"use client";

import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { mockEvents, mockFeatures } from "../core/mockData";
import type { ProjectRegistry, ProjectRegistryEntry, WorkItem, WorkItemEvent } from "../core/types";
import { ErrorModal } from "./ErrorModal";
import { DiscardConfirmModal } from "./DiscardConfirmModal";
import { EditProjectModal } from "./EditProjectModal";
import { RemoveConfirmModal } from "./RemoveConfirmModal";

type RightTab = "agents" | "md" | "diff";
type WorkspaceView = "journal" | "board";

interface WorkspaceContextValue {
  activeFeatureId: string | null;
  activeProjectId: string | null;
  activeRightTab: RightTab;
  activeView: WorkspaceView;
  expandedProjects: Record<string, boolean>;
  expandedAgents: Record<string, boolean>;
  features: WorkItem[];
  projects: ProjectRegistry;
  events: Record<string, WorkItemEvent[]>;
  resolvedDecisions: Record<string, Record<string, string>>;
  selectFeature: (featureId: string) => void;
  setRightTab: (tab: RightTab) => void;
  toggleWorkspaceView: () => void;
  toggleProject: (projectName: string) => void;
  addProject: () => Promise<void>;
  openProject: (projectId: string) => Promise<void>;
  editProject: (project: ProjectRegistryEntry) => void;
  requestProjectRemoval: (project: ProjectRegistryEntry) => void;
  toggleAgent: (agentId: string) => void;
  submitReply: (featureId: string, text: string) => void;
  submitDecision: (featureId: string, decisionId: string, option: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const defaultFeatureId = mockFeatures[0]?.id ?? null;
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

const sortProjects = (projects: ProjectRegistry): ProjectRegistry =>
  [...projects].sort((left, right) => right.last_opened_at.localeCompare(left.last_opened_at) || left.id.localeCompare(right.id));

const isProject = (value: unknown): value is ProjectRegistryEntry => {
  if (typeof value !== "object" || value === null) return false;
  const project = value as Partial<ProjectRegistryEntry>;
  return typeof project.id === "string"
    && typeof project.name === "string"
    && typeof project.path === "string"
    && typeof project.last_opened_at === "string";
};

const requestProjectOpen = async (projectId: string): Promise<ProjectRegistryEntry | null> => {
  try {
    const response = await fetch("/api/projects/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: projectId }),
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    const project = (data as { project?: unknown }).project;
    return isProject(project) ? project : null;
  } catch {
    return null;
  }
};

const mergeProject = (project: ProjectRegistryEntry, current: ProjectRegistry): ProjectRegistryEntry => ({
  ...project,
  available: current.find((candidate) => candidate.id === project.id)?.available ?? true,
});

const pickerErrorDetails = async (response: Response): Promise<string> => {
  const data: unknown = await response.json().catch(() => null);
  const error = (data as { details?: unknown; error?: unknown })?.details ?? (data as { error?: unknown })?.error;
  return typeof error === "string" ? error : "The native directory picker could not be opened.";
};

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const [activeFeatureId, setActiveFeatureId] = useState<string | null>(defaultFeatureId);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<RightTab>("agents");
  const [activeView, setActiveView] = useState<WorkspaceView>("journal");
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>(defaultExpandedAgents);
  const [features, setFeatures] = useState<WorkItem[]>(() => [...mockFeatures]);
  const [projects, setProjects] = useState<ProjectRegistry>([]);
  const [events, setEvents] = useState<Record<string, WorkItemEvent[]>>(cloneEvents);
  const [resolvedDecisions, setResolvedDecisions] = useState<Record<string, Record<string, string>>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectRegistryEntry | null>(null);
  const [removingProject, setRemovingProject] = useState<ProjectRegistryEntry | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    const storedFeatureId = window.sessionStorage.getItem("minna_active_feature_id");
    if (storedFeatureId && mockFeatures.some((feature) => feature.id === storedFeatureId)) {
      setActiveFeatureId(storedFeatureId);
    }

    const storedTab = window.sessionStorage.getItem("minna_active_right_tab");
    if (storedTab === "agents" || storedTab === "md" || storedTab === "diff") {
      setActiveRightTab(storedTab);
    }

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

    void (async () => {
      try {
        const response = await fetch("/api/projects");
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (!Array.isArray(data) || !data.every(isProject)) return;

        const loadedProjects = sortProjects(data);
        setProjects(loadedProjects);
        setExpandedProjects(Object.fromEntries(loadedProjects.map((project, index) => [
          project.id,
          readJson(`minna_project_expanded_${project.id}`, index === 0),
        ])));
        const defaultProject = loadedProjects[0];
        if (!defaultProject) return;

        const openedProject = defaultProject.available === false ? null : await requestProjectOpen(defaultProject.id);
        if (openedProject) {
          setProjects((current) => {
            const merged = mergeProject(openedProject, current);
            return sortProjects([merged, ...current.filter((project) => project.id !== merged.id)]);
          });
        }
        setActiveProjectId((current) => current ?? openedProject?.id ?? defaultProject.id);
      } catch {
        // The prototype remains usable when the local registry is unavailable.
      }
    })();
  }, []);

  const value = useMemo<WorkspaceContextValue>(() => ({
    activeFeatureId,
    activeProjectId,
    activeRightTab,
    activeView,
    expandedProjects,
    expandedAgents,
    features,
    projects,
    events,
    resolvedDecisions,
    selectFeature: (featureId) => {
      setActiveFeatureId(featureId);
      const projectName = features.find((feature) => feature.id === featureId)?.project;
      const project = projects.find((candidate) => candidate.name === projectName);
      if (project) setActiveProjectId(project.id);
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
    toggleProject: (projectId) => {
      setExpandedProjects((current) => {
        const next = { ...current, [projectId]: !current[projectId] };
        window.sessionStorage.setItem(`minna_project_expanded_${projectId}`, JSON.stringify(next[projectId]));
        return next;
      });
    },
    addProject: async () => {
      try {
        const pickerResponse = await fetch("/api/projects/pick", { method: "POST" });
        if (!pickerResponse.ok) {
          if (pickerResponse.status !== 400) setValidationError(await pickerErrorDetails(pickerResponse));
          return;
        }
        const pickerData: unknown = await pickerResponse.json();
        if (typeof (pickerData as { path?: unknown }).path !== "string") return;

        const addResponse = await fetch("/api/projects/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: (pickerData as { path: string }).path }),
        });
        if (!addResponse.ok) {
          const errorData: unknown = await addResponse.json().catch(() => null);
          const details = (errorData as { details?: unknown })?.details;
          setValidationError(typeof details === "string" ? details : "The selected project could not be added.");
          return;
        }
        const addData: unknown = await addResponse.json();
        const project = (addData as { project?: unknown }).project;
        if (!isProject(project)) return;

        setProjects((current) => sortProjects([{ ...project, available: true }, ...current.filter((candidate) => candidate.id !== project.id)]));
        setActiveProjectId(project.id);
        setExpandedProjects((current) => ({ ...current, [project.id]: true }));
      } catch {
        setValidationError("The native directory picker could not be opened.");
      }
    },
    openProject: async (projectId) => {
      const currentProject = projects.find((project) => project.id === projectId);
      if (currentProject?.available === false) return;

      const project = await requestProjectOpen(projectId);
      if (!project) return;
      setProjects((current) => {
        const merged = mergeProject(project, current);
        return sortProjects([merged, ...current.filter((candidate) => candidate.id !== merged.id)]);
      });
      setActiveProjectId(project.id);
    },
    editProject: (project) => setEditingProject(project),
    requestProjectRemoval: (project) => setRemovingProject(project),
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
  }), [activeFeatureId, activeProjectId, activeRightTab, activeView, events, expandedAgents, expandedProjects, features, projects, resolvedDecisions]);

  const selectProjectPath = async (): Promise<string | null> => {
    try {
      const response = await fetch("/api/projects/pick", { method: "POST" });
      if (!response.ok) {
        if (response.status !== 400) setValidationError(await pickerErrorDetails(response));
        return null;
      }
      const data: unknown = await response.json();
      return typeof (data as { path?: unknown }).path === "string" ? (data as { path: string }).path : null;
    } catch {
      setValidationError("The native directory picker could not be opened.");
      return null;
    }
  };

  const saveProject = async (name: string, path: string) => {
    if (!editingProject) return;
    try {
      const response = await fetch("/api/projects/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingProject.id, name, path }),
      });
      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        setValidationError(typeof (data as { details?: unknown })?.details === "string" ? (data as { details: string }).details : "The project could not be updated.");
        return;
      }
      const data: unknown = await response.json();
      const project = (data as { project?: unknown }).project;
      if (!isProject(project)) return;
      setProjects((current) => sortProjects(current.map((candidate) => candidate.id === project.id ? mergeProject(project, current) : candidate)));
      setEditingProject(null);
    } catch {
      setValidationError("The project could not be updated.");
    }
  };

  const removeProject = async () => {
    if (!removingProject) return;
    try {
      const response = await fetch("/api/projects/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: removingProject.id }),
      });
      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        setValidationError(typeof (data as { details?: unknown })?.details === "string" ? (data as { details: string }).details : "The project could not be removed.");
        return;
      }
      setProjects((current) => current.filter((project) => project.id !== removingProject.id));
      setExpandedProjects((current) => {
        const { [removingProject.id]: _removed, ...remaining } = current;
        return remaining;
      });
      if (activeProjectId === removingProject.id) setActiveProjectId(null);
      if (features.find((feature) => feature.id === activeFeatureId)?.project === removingProject.name) {
        setActiveFeatureId(null);
        setActiveView("journal");
      }
      setRemovingProject(null);
      setEditingProject(null);
    } catch {
      setValidationError("The project could not be removed.");
    }
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
      {validationError && <ErrorModal details={validationError} onDismiss={() => setValidationError(null)} />}
      {editingProject && <EditProjectModal active={!removingProject} onCancel={(dirty) => dirty ? setConfirmDiscard(true) : setEditingProject(null)} onRemove={() => setRemovingProject(editingProject)} onSave={saveProject} onSelectPath={selectProjectPath} project={editingProject} />}
      {removingProject && <RemoveConfirmModal name={removingProject.name} onCancel={() => setRemovingProject(null)} onRemove={() => void removeProject()} />}
      {confirmDiscard && <DiscardConfirmModal onDiscard={() => { setConfirmDiscard(false); setEditingProject(null); }} onKeepEditing={() => setConfirmDiscard(false)} />}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return workspace;
}
