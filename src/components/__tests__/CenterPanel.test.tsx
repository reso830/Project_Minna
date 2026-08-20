import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { CenterPanel } from "../CenterPanel";
import { mockFeatures } from "../../core/mockData";
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

  it("uses a two-row composer where Shift+Enter preserves a draft and Enter sends it", () => {
    renderPanel("checkout-redesign-001");
    fireEvent.click(screen.getByRole("button", { name: "Select feature" }));

    const composer = screen.getByRole("textbox", { name: /reply to cart drawer refactor/i });
    expect(composer.tagName).toBe("TEXTAREA");
    expect(composer).toHaveAttribute("rows", "2");

    fireEvent.change(composer, { target: { value: "Keep the first line\nfor context" } });
    fireEvent.keyDown(composer, { key: "Enter", shiftKey: true });

    expect(composer).toHaveValue("Keep the first line\nfor context");
    expect(screen.queryByText("Keep the first line")).not.toBeInTheDocument();

    fireEvent.keyDown(composer, { key: "Enter" });

    expect(screen.getByText((_, element) => element?.classList.contains("journal-bubble") && element.textContent === "Keep the first line\nfor context")).toBeInTheDocument();
    expect(composer).toHaveValue("");
  });

  it("offers the Start quick phrase only for a parked feature", () => {
    renderPanel("search-revamp-001");
    fireEvent.click(screen.getByRole("button", { name: "Select feature" }));

    expect(screen.getByRole("button", { name: "Start this feature." })).toBeInTheDocument();
  });

  it("runs the Start quick phrase as a direct state transition before echoing its label", async () => {
    const originalFetch = global.fetch;
    const project = { id: "search-revamp", name: "Search Revamp", path: "/projects/search", last_opened_at: "2026-08-19T00:00:00.000Z", available: true };
    const parked = mockFeatures.find((feature) => feature.id === "search-revamp-001")!;
    const updated = { ...parked, state: "active" as const };
    const fetchMock = jest.fn((url: string) => {
      if (url === "/api/projects") return Promise.resolve({ ok: true, json: async () => [project] });
      if (url === "/api/projects/open") return Promise.resolve({ ok: true, json: async () => ({ project }) });
      if (url.startsWith("/api/work-items?")) return Promise.resolve({ ok: true, json: async () => [parked] });
      if (url.endsWith("/state")) return Promise.resolve({ ok: true, json: async () => updated });
      return Promise.resolve({ ok: false, json: async () => ({ error: "Unexpected request" }) });
    });
    global.fetch = fetchMock;
    try {
      renderPanel("search-revamp-001");
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/work-items?project=search-revamp")));
      fireEvent.click(screen.getByRole("button", { name: "Select feature" }));
      fireEvent.click(screen.getByRole("button", { name: "Start this feature." }));

      await waitFor(() => expect(screen.getByText("active", { selector: ".journal-status" })).toBeInTheDocument());
      expect(screen.queryByRole("button", { name: "Start this feature." })).not.toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith("/api/work-items/search-revamp-001/state", expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ project: "search-revamp", state: "active" }),
      }));
      expect(screen.getByText("Start this feature.")).toBeInTheDocument();
      expect(JSON.parse(window.sessionStorage.getItem("minna_replies_search-revamp-001") ?? "[]")).not.toContainEqual(expect.objectContaining({
        type: "human.message",
        summary: "Start this feature.",
      }));
      expect(JSON.parse(window.sessionStorage.getItem("minna_quick_phrase_echoes_search-revamp-001") ?? "[]")).toContainEqual(expect.objectContaining({
        summary: "Start this feature.",
      }));
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("disables the Start quick phrase while its transition is pending", async () => {
    const originalFetch = global.fetch;
    const project = { id: "search-revamp", name: "Search Revamp", path: "/projects/search", last_opened_at: "2026-08-19T00:00:00.000Z", available: true };
    const parked = mockFeatures.find((feature) => feature.id === "search-revamp-001")!;
    const updated = { ...parked, state: "active" as const };
    let resolveTransition: ((response: { ok: boolean; json: () => Promise<typeof updated> }) => void) | undefined;
    const fetchMock = jest.fn((url: string) => {
      if (url === "/api/projects") return Promise.resolve({ ok: true, json: async () => [project] });
      if (url === "/api/projects/open") return Promise.resolve({ ok: true, json: async () => ({ project }) });
      if (url.startsWith("/api/work-items?")) return Promise.resolve({ ok: true, json: async () => [parked] });
      if (url.endsWith("/state")) return new Promise(resolve => { resolveTransition = resolve; });
      return Promise.resolve({ ok: false, json: async () => ({ error: "Unexpected request" }) });
    });
    global.fetch = fetchMock;
    try {
      renderPanel("search-revamp-001");
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/work-items?project=search-revamp")));
      fireEvent.click(screen.getByRole("button", { name: "Select feature" }));
      fireEvent.click(screen.getByRole("button", { name: "Start this feature." }));

      await waitFor(() => expect(resolveTransition).toBeDefined());
      expect(screen.getByRole("button", { name: "Start this feature." })).toBeDisabled();

      resolveTransition!({ ok: true, json: async () => updated });
      await waitFor(() => expect(screen.queryByRole("button", { name: "Start this feature." })).not.toBeInTheDocument());
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("reveals only the active item's legal state actions on status-chip hover", () => {
    renderPanel("checkout-redesign-001");
    fireEvent.click(screen.getByRole("button", { name: "Select feature" }));

    fireEvent.mouseEnter(screen.getByText("active", { selector: ".journal-status" }));

    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("opens and closes status actions with the keyboard", () => {
    renderPanel("checkout-redesign-001");
    fireEvent.click(screen.getByRole("button", { name: "Select feature" }));

    const trigger = screen.getByRole("button", { name: /status: active/i });
    fireEvent.focus(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: " " });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("opens the close-reason dialog from the status-chip action", () => {
    renderPanel("checkout-redesign-001");
    fireEvent.click(screen.getByRole("button", { name: "Select feature" }));

    fireEvent.mouseEnter(screen.getByText("active", { selector: ".journal-status" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.getByRole("dialog", { name: /close cart drawer refactor/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Done" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Dropped" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Failed" })).toBeInTheDocument();
  });

  it("confirms a close reason through the unified state endpoint", async () => {
    const originalFetch = global.fetch;
    const project = { id: "checkout-redesign", name: "Checkout Redesign", path: "/projects/checkout", last_opened_at: "2026-08-19T00:00:00.000Z", available: true };
    const updated = { ...mockFeatures[0], state: "closed", closed_reason: "done" };
    let resolveTransition: ((response: { ok: boolean; json: () => Promise<typeof updated> }) => void) | undefined;
    const fetchMock = jest.fn((url: string) => {
      if (url === "/api/projects") return Promise.resolve({ ok: true, json: async () => [project] });
      if (url === "/api/projects/open") return Promise.resolve({ ok: true, json: async () => ({ project }) });
      if (url.startsWith("/api/work-items?")) return Promise.resolve({ ok: true, json: async () => [mockFeatures[0]] });
      if (url.endsWith("/state")) return new Promise(resolve => { resolveTransition = resolve; });
      return Promise.resolve({ ok: false, json: async () => ({ error: "Unexpected request" }) });
    });
    global.fetch = fetchMock;
    try {
      renderPanel("checkout-redesign-001");

      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/work-items?project=checkout-redesign")));
      fireEvent.click(screen.getByRole("button", { name: "Select feature" }));
      fireEvent.mouseEnter(screen.getByText("active", { selector: ".journal-status" }));
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      const dialog = screen.getByRole("dialog", { name: /close cart drawer refactor/i });
      fireEvent.click(within(dialog).getByRole("radio", { name: "Done" }));
      fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));

      await waitFor(() => expect(resolveTransition).toBeDefined());
      expect(within(dialog).getByRole("button", { name: "Close" })).toBeDisabled();
      resolveTransition!({ ok: true, json: async () => updated });
      await waitFor(() => expect(screen.getByText("closed", { selector: ".journal-status" })).toBeInTheDocument());
      expect(fetchMock).toHaveBeenCalledWith("/api/work-items/checkout-redesign-001/state", expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ project: "checkout-redesign", state: "closed", closed_reason: "done" }),
      }));
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("does not expose a state-action menu for a closed item", () => {
    renderPanel("checkout-redesign-003");
    fireEvent.click(screen.getByRole("button", { name: "Select feature" }));

    fireEvent.mouseEnter(screen.getByText("closed", { selector: ".journal-status" }));

    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
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
