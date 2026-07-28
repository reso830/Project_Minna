import { fireEvent, render, screen, within } from "@testing-library/react";

import { CenterPanel } from "../CenterPanel";
import { WorkspaceProvider, useWorkspace } from "../WorkspaceProvider";

function FeatureSelection({ featureId }: { featureId: string }) {
  const { selectFeature } = useWorkspace();

  return <button onClick={() => selectFeature(featureId)} type="button">Select feature</button>;
}

function renderPanel(featureId: string) {
  return render(
    <WorkspaceProvider>
      <FeatureSelection featureId={featureId} />
      <CenterPanel />
    </WorkspaceProvider>,
  );
}

describe("CenterPanel", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("shows an empty-state prompt for a selected feature with no timeline events", () => {
    renderPanel("checkout-redesign-003");

    fireEvent.click(screen.getByRole("button", { name: "Select feature" }));

    expect(screen.getByRole("heading", { name: "Empty state copy" })).toBeInTheDocument();
    expect(screen.getByText(/no journal activity yet/i)).toBeInTheDocument();
  });

  it("adds a non-empty composer reply and clears the input", () => {
    renderPanel("checkout-redesign-001");
    fireEvent.click(screen.getByRole("button", { name: "Select feature" }));

    const composer = screen.getByRole("textbox", { name: /reply to cart drawer refactor/i });
    fireEvent.change(composer, { target: { value: "Ship the drawer update" } });
    fireEvent.keyDown(composer, { key: "Enter" });

    expect(screen.getByText("Ship the drawer update")).toBeInTheDocument();
    expect(composer).toHaveValue("");
    const timeline = screen.getByLabelText("Journal timeline");
    const events = within(timeline).getAllByRole("article");
    expect(events.at(-1)).toHaveTextContent("Ship the drawer update");
    expect(within(events.at(-1)!).getByText(/^\d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it("replaces a pending decision with its resolved choice", () => {
    renderPanel("checkout-redesign-002");
    fireEvent.click(screen.getByRole("button", { name: "Select feature" }));

    fireEvent.click(screen.getByRole("button", { name: "Approve changes" }));

    expect(screen.getByText("✓ Approve changes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Keep current policy" })).not.toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("does not submit whitespace-only composer input", () => {
    renderPanel("checkout-redesign-001");
    fireEvent.click(screen.getByRole("button", { name: "Select feature" }));

    const composer = screen.getByRole("textbox", { name: /reply to cart drawer refactor/i });
    fireEvent.change(composer, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));

    expect(composer).toHaveValue("   ");
    expect(screen.queryByText("human")).not.toBeInTheDocument();
  });
});
