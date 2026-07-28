"use client";

import { WorkspaceProvider } from "../components/WorkspaceProvider";
import { CenterPanel } from "../components/CenterPanel";
import { RightPanel } from "../components/RightPanel";
import { Sidebar } from "../components/Sidebar";

export default function HomePage() {
  return (
    <WorkspaceProvider>
      <main className="workspace-skeleton">
        <aside aria-label="Sidebar" className="workspace-sidebar"><Sidebar /></aside>
        <section aria-label="Journal" className="workspace-journal"><CenterPanel /></section>
        <aside aria-label="Details" className="workspace-details"><RightPanel /></aside>
      </main>
    </WorkspaceProvider>
  );
}
