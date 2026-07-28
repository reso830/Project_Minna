"use client";

import Image from "next/image";

import { WorkspaceProvider } from "../components/WorkspaceProvider";
import { CenterPanel } from "../components/CenterPanel";
import { RightPanel } from "../components/RightPanel";
import { Sidebar } from "../components/Sidebar";
import { useWorkspace } from "../components/WorkspaceProvider";

const boardColumns = [
  { state: "active", label: "ACTIVE", color: "#00c9d6" },
  { state: "blocked", label: "BLOCKED", color: "#7a1f30" },
  { state: "parked", label: "PARKED", color: "#9a9a94" },
  { state: "closed", label: "CLOSED", color: "#2f9e44" },
] as const;

function featureNumber(id: string): string {
  return id.split("-").at(-1) ?? id;
}

function BoardPanel() {
  const { activeFeatureId, features, selectFeature } = useWorkspace();
  const activeFeature = features.find((feature) => feature.id === activeFeatureId) ?? features[0];
  const projectFeatures = features.filter((feature) => feature.project === activeFeature?.project);

  return (
    <section aria-label="Kanban board" className="workspace-board">
      <header className="board-header">
        <h1>Kanban Board: {activeFeature?.project}</h1>
        <button type="button">+ Add Feature</button>
      </header>
      <div className="board-columns">
        {boardColumns.map((column) => (
          <section className="board-column" key={column.state}>
            <h2><span style={{ backgroundColor: column.color }} />{column.label}</h2>
            {projectFeatures.filter((feature) => feature.state === column.state).map((feature) => (
              <button className="board-card" key={feature.id} onClick={() => selectFeature(feature.id)} type="button">
                <span>{featureNumber(feature.id)}</span>
                <strong>{feature.title}</strong>
                <em>{feature.phase}</em>
              </button>
            ))}
          </section>
        ))}
      </div>
    </section>
  );
}

function BlankPreview() {
  return (
    <section aria-label="Blank preview" className="workspace-empty">
      <Image alt="Minna" height={96} priority src="/assets/minna-mark.png" width={96} />
      <div>
        <h1>Nothing running yet</h1>
        <p>Describe what you want built. Minna will spin up agents, keep a journal of decisions, and check in when it needs you.</p>
      </div>
    </section>
  );
}

function WorkspaceContent() {
  const { activeView } = useWorkspace();

  if (activeView === "blank") return <BlankPreview />;
  if (activeView === "board") return <BoardPanel />;

  return (
    <>
      <section aria-label="Journal" className="workspace-journal"><CenterPanel /></section>
      <aside aria-label="Details" className="workspace-details"><RightPanel /></aside>
    </>
  );
}

export default function HomePage() {
  return (
    <WorkspaceProvider>
      <main className="workspace-skeleton">
        <aside aria-label="Sidebar" className="workspace-sidebar"><Sidebar /></aside>
        <WorkspaceContent />
      </main>
    </WorkspaceProvider>
  );
}
