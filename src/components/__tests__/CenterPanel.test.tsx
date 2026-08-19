import { act, fireEvent, render, screen, within } from "@testing-library/react";

import { CenterPanel } from "../CenterPanel";
import { WorkspaceProvider, useWorkspace } from "../WorkspaceProvider";

function FeatureSelection({ featureId }: { featureId: string }) {
  const { selectFeature } = useWorkspace();

  return <button onClick={() => selectFeature(featureId)} type="button">Select feature</button>;
}

function FeatureSelections({ featureIds }: { featureIds: string[] }) {
  const { selectFeature } = useWorkspace();

  return (
    <>
      {featureIds.map((featureId) => (
        <button key={featureId} onClick={() => selectFeature(featureId)} type="button">Select {featureId}</button>
      ))}
    </>
  );
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

  afterEach(() => {
    jest.useRealTimers();
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
    expect(within(events.at(-1)!).getByText(/· \d{4}$/)).toBeInTheDocument();
  });

  it("replaces a pending decision with its resolved choice", () => {
    renderPanel("checkout-redesign-002");
    fireEvent.click(screen.getByRole("button", { name: "Select feature" }));

    fireEvent.click(screen.getByRole("button", { name: "Approve changes" }));

    expect(screen.getByText("✓ Approve changes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Keep current policy" })).not.toBeInTheDocument();
    expect(screen.getAllByText("active").length).toBeGreaterThan(0);
  });

  it("shows the selected feature metadata while the details control is hovered", () => {
    renderPanel("checkout-redesign-001");
    fireEvent.click(screen.getByRole("button", { name: "Select feature" }));

    expect(screen.getByText("active", { selector: ".journal-status" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Feature details")).not.toBeInTheDocument();

    const detailsControl = screen.getByRole("button", { name: "Show details" });
    fireEvent.mouseEnter(detailsControl);

    expect(screen.getByLabelText("Feature details")).toHaveTextContent("Cart drawer refactor");
  });

  it("keeps details visible when pinned and closes them immediately when unpinned", () => {
    jest.useFakeTimers();
    renderPanel("checkout-redesign-001");
    fireEvent.click(screen.getByRole("button", { name: "Select feature" }));

    const detailsControl = screen.getByRole("button", { name: "Show details" });
    fireEvent.click(detailsControl);

    expect(detailsControl).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Feature details")).toBeInTheDocument();

    fireEvent.mouseLeave(detailsControl);
    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(screen.getByLabelText("Feature details")).toBeInTheDocument();

    fireEvent.mouseEnter(detailsControl);
    fireEvent.click(detailsControl);

    expect(detailsControl).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByLabelText("Feature details")).not.toBeInTheDocument();
  });

  it("keeps details open while moving from the control into the panel, then closes after 150ms", () => {
    jest.useFakeTimers();
    renderPanel("checkout-redesign-001");
    fireEvent.click(screen.getByRole("button", { name: "Select feature" }));

    const detailsControl = screen.getByRole("button", { name: "Show details" });
    fireEvent.mouseEnter(detailsControl);
    const detailsPanel = screen.getByLabelText("Feature details");
    fireEvent.mouseLeave(detailsControl);

    act(() => {
      jest.advanceTimersByTime(100);
    });
    fireEvent.mouseEnter(detailsPanel);
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(screen.getByLabelText("Feature details")).toBeInTheDocument();

    fireEvent.mouseLeave(detailsPanel);
    act(() => {
      jest.advanceTimersByTime(149);
    });
    expect(screen.getByLabelText("Feature details")).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.queryByLabelText("Feature details")).not.toBeInTheDocument();
  });

  it("resets details state when the selected feature changes", () => {
    render(
      <WorkspaceProvider>
        <FeatureSelections featureIds={["checkout-redesign-001", "checkout-redesign-002"]} />
        <CenterPanel />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select checkout-redesign-001" }));
    fireEvent.click(screen.getByRole("button", { name: "Show details" }));
    expect(screen.getByLabelText("Feature details")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select checkout-redesign-002" }));
    expect(screen.queryByLabelText("Feature details")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show details" })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the timeline bottom-aligned when opening details from the bottom", () => {
    renderPanel("checkout-redesign-001");
    fireEvent.click(screen.getByRole("button", { name: "Select feature" }));

    const timeline = screen.getByLabelText("Journal timeline");
    Object.defineProperties(timeline, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, value: 300, writable: true },
    });
    fireEvent.scroll(timeline);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Show details" }));

    expect(timeline.scrollTop).toBe(400);
  });

  it("preserves a scrolled-up timeline position when details close", () => {
    jest.useFakeTimers();
    renderPanel("checkout-redesign-001");
    fireEvent.click(screen.getByRole("button", { name: "Select feature" }));

    const timeline = screen.getByLabelText("Journal timeline");
    Object.defineProperties(timeline, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, value: 300, writable: true },
    });
    fireEvent.scroll(timeline);

    const detailsControl = screen.getByRole("button", { name: "Show details" });
    fireEvent.mouseEnter(detailsControl);
    timeline.scrollTop = 60;
    fireEvent.scroll(timeline);
    fireEvent.mouseLeave(detailsControl);

    act(() => {
      jest.advanceTimersByTime(150);
    });

    expect(timeline.scrollTop).toBe(60);
  });

  it("renders the title-bar identity, phase, and details control for an assigned agent", () => {
    renderPanel("checkout-redesign-001");
    fireEvent.click(screen.getByRole("button", { name: "Select feature" }));

    expect(screen.getByRole("img", { name: "Assignee: claude" })).toHaveTextContent("A1");
    expect(screen.getByText("001", { selector: ".journal-feature-id" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show details" })).toBeInTheDocument();
  });

  it("uses the Minna avatar for an unassigned feature", () => {
    renderPanel("search-revamp-001");
    fireEvent.click(screen.getByRole("button", { name: "Select feature" }));

    expect(screen.getByRole("img", { name: "Assignee: Minna" })).toBeInTheDocument();
  });

  it("renders the domain agent as the handoff's agent-1 label", () => {
    renderPanel("checkout-redesign-001");
    fireEvent.click(screen.getByRole("button", { name: "Select feature" }));

    expect(screen.getAllByText("agent-1").length).toBeGreaterThan(0);
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
