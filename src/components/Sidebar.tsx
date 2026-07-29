"use client";

import Image from "next/image";

import { AgentUsage } from "./AgentUsage";
import { ChevronIcon, EllipsisIcon, PlusIcon, RemoveIcon, SettingsIcon, ViewToggleIcon } from "./icons";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "./WorkspaceProvider";

function featureNumber(id: string): string {
  return id.split("-").at(-1) ?? id;
}

export function Sidebar() {
  const {
    activeFeatureId,
    activeProjectId,
    addProject,
    editProject,
    expandedProjects,
    features,
    openProject,
    projects,
    requestProjectRemoval,
    selectFeature,
    toggleProject,
    toggleWorkspaceView,
  } = useWorkspace();
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dismissMenu = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuProjectId(null);
    };
    document.addEventListener("mousedown", dismissMenu);
    return () => document.removeEventListener("mousedown", dismissMenu);
  }, []);

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
                <div className="sidebar-project-menu" ref={menuProjectId === project.id ? menuRef : undefined}>
                  <button aria-expanded={menuProjectId === project.id} aria-label={`Project actions for ${project.name}`} className="sidebar-project-menu-trigger" onClick={() => setMenuProjectId((current) => current === project.id ? null : project.id)} type="button"><EllipsisIcon /></button>
                  {menuProjectId === project.id && (
                    <div className="sidebar-project-popover">
                      <button onClick={() => { setMenuProjectId(null); editProject(project); }} type="button"><SettingsIcon />Edit Project</button>
                      <button className="sidebar-project-popover-remove" onClick={() => { setMenuProjectId(null); requestProjectRemoval(project); }} type="button"><RemoveIcon />Remove Project</button>
                    </div>
                  )}
                </div>
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
