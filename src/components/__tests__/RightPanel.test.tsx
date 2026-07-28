import { fireEvent, render, screen } from "@testing-library/react";

import { RightPanel } from "../RightPanel";
import { WorkspaceProvider, useWorkspace } from "../WorkspaceProvider";

function FeatureSelection() {
  const { selectFeature } = useWorkspace();

  return (
    <button onClick={() => selectFeature("checkout-redesign-001")} type="button">
      Select cart drawer
    </button>
  );
}

function renderPanel() {
  return render(
    <WorkspaceProvider>
      <FeatureSelection />
      <RightPanel />
    </WorkspaceProvider>,
  );
}

describe("RightPanel", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("expands and collapses the selected feature agent log", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Select cart drawer" }));

    const agent = screen.getByRole("button", { name: /agent-1.*working/i });
    expect(agent).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("$ writing CartDrawer.tsx")).toBeInTheDocument();

    fireEvent.click(agent);
    expect(agent).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("$ writing CartDrawer.tsx")).not.toBeInTheDocument();
  });

  it("switches between the plan markdown and unified diff detail views", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Select cart drawer" }));

    fireEvent.click(screen.getByRole("tab", { name: "MD" }));
    expect(screen.getByRole("heading", { name: "Cart drawer refactor" })).toBeInTheDocument();
    expect(screen.getByText("Extract drawer state")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "DIFF" }));
    expect(screen.getByText("@@ -12,3 +12,5 @@")).toBeInTheDocument();
    expect(screen.getByText("+const [open, setOpen] = useState(false);")).toBeInTheDocument();
    expect(screen.getByText("-const open = false;")).toBeInTheDocument();
  });

  it("associates the active tab with its detail panel", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Select cart drawer" }));
    fireEvent.click(screen.getByRole("tab", { name: "MD" }));

    const tab = screen.getByRole("tab", { name: "MD" });
    const panel = screen.getByRole("tabpanel");

    expect(tab).toHaveAttribute("aria-controls", "details-md");
    expect(panel).toHaveAttribute("id", "details-md");
    expect(panel).toHaveAttribute("aria-labelledby", "details-tab-md");
  });
});
