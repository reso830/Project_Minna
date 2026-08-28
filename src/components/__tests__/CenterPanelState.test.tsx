import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { mockFeatures } from "../../core/mockData";
import type { WorkItem } from "../../core/types";
import { CenterPanel } from "../CenterPanel";
import { WorkspaceProvider, useWorkspace } from "../WorkspaceProvider";

function FeatureSelection({ featureId }: { featureId: string }) {
  const { selectFeature } = useWorkspace();

  return <button onClick={() => selectFeature(featureId)} type="button">Select feature</button>;
}

function response(json: unknown) {
  return Promise.resolve({ ok: true, json: async () => json });
}

function renderStatePanel(feature: WorkItem) {
  const project = {
    id: feature.id.slice(0, feature.id.lastIndexOf("-")),
    name: feature.project,
    path: `/projects/${feature.id.slice(0, feature.id.lastIndexOf("-"))}`,
    last_opened_at: "2026-08-20T00:00:00.000Z",
    available: true,
  };
  let currentFeature = feature;
  const fetchMock = jest.fn((url: string, options?: RequestInit) => {
    if (url === "/api/projects") return response([project]);
    if (url === "/api/projects/open") return response({ project });
    if (url.startsWith("/api/work-items?")) return response([currentFeature]);
    if (url.endsWith("/state")) {
      const body = JSON.parse(String(options?.body)) as { state: WorkItem["state"]; closed_reason?: "done" | "dropped" | "failed" };
      const from = currentFeature.state;
      currentFeature = { ...currentFeature, state: body.state, closed_reason: body.closed_reason ?? null };
      return response({
        ...currentFeature,
        event: {
          work_item_id: currentFeature.id,
          timestamp: "2026-08-20T01:00:00.000Z",
          actor: "human",
          type: "work_item.state_changed",
          summary: `State changed from ${from} to ${body.state}.`,
          artifact_path: null,
          payload: { from, to: body.state, blocked_reason: null, closed_reason: body.closed_reason ?? null },
        },
      });
    }
    return Promise.resolve({ ok: false, json: async () => ({ error: "Unexpected request" }) });
  });
  global.fetch = fetchMock;

  render(
    <WorkspaceProvider>
      <FeatureSelection featureId={feature.id} />
      <CenterPanel />
    </WorkspaceProvider>,
  );

  return fetchMock;
}

async function selectLoadedFeature(fetchMock: jest.Mock) {
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/work-items?project=")));
  fireEvent.click(screen.getByRole("button", { name: "Select feature" }));
}

describe("CenterPanel state transitions", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("starts a parked feature with its quick phrase", async () => {
    const parked = mockFeatures.find((feature) => feature.id === "search-revamp-001")!;
    const fetchMock = renderStatePanel(parked);
    await selectLoadedFeature(fetchMock);

    fireEvent.click(screen.getByRole("button", { name: "Start this feature." }));

    await waitFor(() => expect(screen.getByText("active", { selector: ".journal-status" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Start this feature." })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/work-items/${parked.id}/state`, expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ project: "search-revamp", state: "active" }),
    }));
  });

  it("reveals Pause and Close from an active status chip without transitioning on hover", async () => {
    const active = mockFeatures.find((feature) => feature.id === "checkout-redesign-001")!;
    const fetchMock = renderStatePanel(active);
    await selectLoadedFeature(fetchMock);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Status: active" }));

    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(`/api/work-items/${active.id}/state`, expect.anything());
  });

  it("shows a Minna journal line after pausing an active feature", async () => {
    const active = mockFeatures.find((feature) => feature.id === "checkout-redesign-001")!;
    const fetchMock = renderStatePanel(active);
    await selectLoadedFeature(fetchMock);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Status: active" }));
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    await waitFor(() => expect(screen.getByText("parked", { selector: ".journal-status" })).toBeInTheDocument());
    expect(screen.getByText("Feature paused as requested.")).toBeInTheDocument();
    expect(window.sessionStorage.getItem(`minna_replies_${active.id}`)).toBeNull();
  });

  it("closes an active feature with the selected done reason", async () => {
    const active = mockFeatures.find((feature) => feature.id === "checkout-redesign-001")!;
    const fetchMock = renderStatePanel(active);
    await selectLoadedFeature(fetchMock);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Status: active" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    const dialog = screen.getByRole("dialog", { name: /close cart drawer refactor/i });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Done" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.getByText("closed", { selector: ".journal-status" })).toBeInTheDocument());
    expect(screen.getByText("Feature closed as requested.")).toBeInTheDocument();
    expect(window.sessionStorage.getItem(`minna_replies_${active.id}`)).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(`/api/work-items/${active.id}/state`, expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ project: "checkout-redesign", state: "closed", closed_reason: "done" }),
    }));
  });

  it("renders a paused state-change event as a Minna journal line", async () => {
    const active = mockFeatures.find((feature) => feature.id === "checkout-redesign-001")!;
    window.sessionStorage.setItem(`minna_replies_${active.id}`, JSON.stringify([{
      work_item_id: active.id,
      timestamp: "2026-08-20T01:00:00.000Z",
      actor: "human",
      type: "work_item.state_changed",
      summary: "State changed from active to parked.",
      artifact_path: null,
      payload: { from: "active", to: "parked", blocked_reason: null, closed_reason: null },
    }]));
    const fetchMock = renderStatePanel(active);
    await selectLoadedFeature(fetchMock);

    const message = screen.getByText("Feature paused as requested.");
    expect(within(message.closest("article")!).getByText("minna")).toBeInTheDocument();
  });

  it("renders a closed state-change event as a Minna journal line", async () => {
    const closed = mockFeatures.find((feature) => feature.id === "checkout-redesign-003")!;
    window.sessionStorage.setItem(`minna_replies_${closed.id}`, JSON.stringify([{
      work_item_id: closed.id,
      timestamp: "2026-08-20T01:00:00.000Z",
      actor: "human",
      type: "work_item.state_changed",
      summary: "State changed from active to closed.",
      artifact_path: null,
      payload: { from: "active", to: "closed", blocked_reason: null, closed_reason: "done" },
    }]));
    const fetchMock = renderStatePanel(closed);
    await selectLoadedFeature(fetchMock);

    const message = screen.getByText("Feature closed as requested.");
    expect(within(message.closest("article")!).getByText("minna")).toBeInTheDocument();
  });

  it("renders a closed feature as a non-interactive terminal state", async () => {
    const closed = mockFeatures.find((feature) => feature.id === "checkout-redesign-003")!;
    const fetchMock = renderStatePanel(closed);
    await selectLoadedFeature(fetchMock);

    const status = screen.getByText("closed", { selector: ".journal-status" });
    expect(status.tagName).toBe("SPAN");
    expect(screen.queryByRole("button", { name: /status: closed/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start this feature." })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();

    const composer = screen.getByRole("textbox", { name: /reply to empty state copy/i });
    expect(composer).toBeDisabled();
    expect(composer.closest(".journal-composer")).toHaveClass("journal-composer--closed");
    expect(screen.getByRole("button", { name: "Send reply" })).toBeDisabled();
    fireEvent.keyDown(composer, { key: "Enter" });
    expect(screen.queryByText("human")).not.toBeInTheDocument();
  });
});
