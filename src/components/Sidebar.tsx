"use client";

import Image from "next/image";

import { AgentUsage } from "./AgentUsage";
import { ChevronIcon, PlusIcon, SettingsIcon, ViewToggleIcon } from "./icons";
import { useWorkspace } from "./WorkspaceProvider";

function featureNumber(id: string): string {
  return id.split("-").at(-1) ?? id;
}

export function Sidebar() {
  const {
    activeFeatureId,
    activeProjectId,
    addProject,
    expandedProjects,
    features,
    openProject,
    projects,
    selectFeature,
    toggleProject,
    toggleWorkspaceView,
  } = useWorkspace();

  return (
    <div className="sidebar">
      <header className="sidebar-header">
        <div className="sidebar-brand">
          <Image alt="Minna" height={44} priority src="/assets/minna-mark.png" width={44} />
          <span>minna</span>
        </div>
        <div className="sidebar-header-actions">
          <button aria-label="Switch workspace view" className="sidebar-icon-button" onClick={toggleWorkspaceView} type="button"><ViewToggleIcon /></button>
          <button aria-label="Settings" className="sidebar-icon-button sidebar-icon-button--settings" type="button"><SettingsIcon /></button>
        </div>
      </header>

      <div className="sidebar-projects-heading">
        <span>Projects</span>
        <button aria-label="Add project" className="sidebar-icon-button sidebar-add-project" onClick={() => void addProject()} type="button"><PlusIcon /></button>
      </div>

      <nav aria-label="Projects" className="sidebar-projects">
        {projects.map((project) => {
          const isExpanded = expandedProjects[project.id] ?? false;
          const projectFeatures = features.filter((feature) => feature.project === project.name);
          const hasBlockedChild = !isExpanded && projectFeatures.some((feature) => feature.state === "blocked");
          const isSelected = activeProjectId === project.id || projectFeatures.some((feature) => feature.id === activeFeatureId);

          return (
            <div className="sidebar-project" key={project.id}>
              <div className={`sidebar-project-row${hasBlockedChild ? " sidebar-project-row--blocked" : ""}${isSelected ? " sidebar-project-row--selected" : ""}${project.available === false ? " sidebar-project-row--unavailable" : ""}`}>
                <button
                  aria-expanded={isExpanded}
                  className={`sidebar-project-toggle${hasBlockedChild ? " sidebar-project-toggle--blocked" : ""}${isSelected ? " sidebar-project-toggle--selected" : ""}${project.available === false ? " sidebar-project-toggle--unavailable" : ""}`}
                  disabled={project.available === false}
                  onClick={() => {
                    toggleProject(project.id);
                    if (project.id !== activeProjectId) void openProject(project.id);
                  }}
                  type="button"
                >
                  <span aria-hidden="true" className="sidebar-chevron"><ChevronIcon direction={isExpanded ? "down" : "right"} /></span>
                  <span>{project.name}</span>
                </button>
                <button
                  aria-label={`Add feature to ${project.name}`}
                  className="sidebar-add-feature"
                  onClick={(event) => event.stopPropagation()}
                  type="button"
                >
                  <PlusIcon size={12} />
                </button>
              </div>
              {isExpanded && (
                <div className="sidebar-feature-list">
                  {projectFeatures.length === 0 ? <span className="sidebar-empty-project">No features found</span> : projectFeatures.map((feature) => (
                    <button
                      aria-pressed={activeFeatureId === feature.id}
                      aria-label={`${feature.title}, ${feature.state}`}
                      className={`sidebar-feature sidebar-feature--${feature.state}`}
                      key={feature.id}
                      onClick={() => selectFeature(feature.id)}
                      type="button"
                    >
                      <span aria-hidden="true" className="feature-state-dot" />
                      <span className="sidebar-feature-id">{featureNumber(feature.id)}</span>
                      <span className="sidebar-feature-title">{feature.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <footer className="sidebar-footer">
        <div aria-label="Avatar placeholder" className="sidebar-avatar-placeholder">
          avatar<br />(dynamic)
        </div>
        <AgentUsage />
      </footer>
    </div>
  );
}
