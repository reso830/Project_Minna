"use client";

import Image from "next/image";

import { AgentUsage } from "./AgentUsage";
import { useWorkspace } from "./WorkspaceProvider";

function featureNumber(id: string): string {
  return id.split("-").at(-1) ?? id;
}

export function Sidebar() {
  const { activeFeatureId, expandedProjects, features, selectFeature, toggleProject } = useWorkspace();
  const projects = [...new Set(features.map((feature) => feature.project))];

  return (
    <div className="sidebar">
      <header className="sidebar-header">
        <div className="sidebar-brand">
          <Image alt="Minna" height={44} priority src="/assets/minna-mark.png" width={44} />
          <span>minna</span>
        </div>
        <button aria-label="Workspace menu" className="sidebar-icon-button" type="button">•••</button>
      </header>

      <div className="sidebar-projects-heading">
        <span>Projects</span>
        <button aria-label="Add project" className="sidebar-icon-button" type="button">+</button>
      </div>

      <nav aria-label="Projects" className="sidebar-projects">
        {projects.map((project) => {
          const isExpanded = expandedProjects[project] ?? false;
          const projectFeatures = features.filter((feature) => feature.project === project);
          const hasBlockedChild = !isExpanded && projectFeatures.some((feature) => feature.state === "blocked");

          return (
            <div className="sidebar-project" key={project}>
              <div className="sidebar-project-row">
                <button
                  aria-expanded={isExpanded}
                  className={`sidebar-project-toggle${hasBlockedChild ? " sidebar-project-toggle--blocked" : ""}`}
                  onClick={() => toggleProject(project)}
                  type="button"
                >
                  <span aria-hidden="true" className="sidebar-chevron">{isExpanded ? "⌄" : "›"}</span>
                  <span>{project}</span>
                </button>
                <button
                  aria-label={`Add feature to ${project}`}
                  className="sidebar-add-feature"
                  onClick={(event) => event.stopPropagation()}
                  type="button"
                >
                  +
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
                      <span className="sidebar-feature-copy">
                        <span className="sidebar-feature-title">{feature.title}</span>
                        <span className="sidebar-feature-id">{featureNumber(feature.id)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <footer className="sidebar-footer">
        <div aria-label="Current user" className="sidebar-user">
          <span aria-hidden="true" className="sidebar-avatar">A</span>
          <span>Alvin</span>
        </div>
        <AgentUsage />
      </footer>
    </div>
  );
}
