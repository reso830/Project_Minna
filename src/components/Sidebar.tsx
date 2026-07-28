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
    expandedProjects,
    features,
    selectFeature,
    toggleProject,
    toggleWorkspaceView,
  } = useWorkspace();
  const projects = [...new Set(features.map((feature) => feature.project))];

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
        <button aria-label="Add project" className="sidebar-icon-button sidebar-add-project" type="button"><PlusIcon /></button>
      </div>

      <nav aria-label="Projects" className="sidebar-projects">
        {projects.map((project) => {
          const isExpanded = expandedProjects[project] ?? false;
          const projectFeatures = features.filter((feature) => feature.project === project);
          const hasBlockedChild = !isExpanded && projectFeatures.some((feature) => feature.state === "blocked");
          const hasSelectedFeature = projectFeatures.some((feature) => feature.id === activeFeatureId);

          return (
            <div className="sidebar-project" key={project}>
              <div className={`sidebar-project-row${hasBlockedChild ? " sidebar-project-row--blocked" : ""}${hasSelectedFeature ? " sidebar-project-row--selected" : ""}`}>
                <button
                  aria-expanded={isExpanded}
                  className={`sidebar-project-toggle${hasBlockedChild ? " sidebar-project-toggle--blocked" : ""}${hasSelectedFeature ? " sidebar-project-toggle--selected" : ""}`}
                  onClick={() => toggleProject(project)}
                  type="button"
                >
                  <span aria-hidden="true" className="sidebar-chevron"><ChevronIcon direction={isExpanded ? "down" : "right"} /></span>
                  <span>{project}</span>
                </button>
                <button
                  aria-label={`Add feature to ${project}`}
                  className="sidebar-add-feature"
                  onClick={(event) => event.stopPropagation()}
                  type="button"
                >
                  <PlusIcon size={12} />
                </button>
              </div>
              {isExpanded && (
                <div className="sidebar-feature-list">
                  {projectFeatures.map((feature) => (
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
