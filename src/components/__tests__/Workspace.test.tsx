import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";

import HomePage from "../../app/page";
import { mockFeatures } from "../../core/mockData";
import { WorkspaceProvider, useWorkspace } from "../WorkspaceProvider";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <WorkspaceProvider>{children}</WorkspaceProvider>
);

function AddProjectButton() {
  const { addProject } = useWorkspace();
  return <button onClick={() => void addProject()} type="button">Add project</button>;
}

function RemoveActiveProjectButton() {
  const { activeFeatureId, projects, requestProjectRemoval } = useWorkspace();
  return (
    <>
      <output>{activeFeatureId ?? "none"}</output>
      <button onClick={() => requestProjectRemoval(projects[0]!)} type="button">Remove active project</button>
    </>
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  global.fetch = jest.fn(() => new Promise<Response>(() => {}));
});

test("persists a selected feature and resolves its decision in session storage", async () => {
  const firstMount = renderHook(() => useWorkspace(), { wrapper });

  act(() => {
    firstMount.result.current.selectFeature("checkout-redesign-002");
    firstMount.result.current.submitDecision(
      "checkout-redesign-002",
      "payment-retry-policy",
      "Approve changes",
    );
  });

  expect(firstMount.result.current.activeFeatureId).toBe("checkout-redesign-002");
  expect(
    firstMount.result.current.features.find((feature) => feature.id === "checkout-redesign-002")?.state,
  ).toBe("active");
  expect(window.sessionStorage.getItem("minna_active_feature_id")).toBe(
    "checkout-redesign-002",
  );
  expect(window.sessionStorage.getItem("minna_decisions_checkout-redesign-002")).toContain(
    "Approve changes",
  );

  firstMount.unmount();
  const reloadedMount = renderHook(() => useWorkspace(), { wrapper });
  await waitFor(() =>
    expect(
      reloadedMount.result.current.events["checkout-redesign-002"].some(
        (event) => event.type === "human.decided" && event.summary === "Approve changes",
      ),
    ).toBe(true),
  );
});

test("restores independently expanded agent panes", async () => {
  const firstMount = renderHook(() => useWorkspace(), { wrapper });

  act(() => {
    firstMount.result.current.toggleAgent("checkout-redesign-001-agent-2");
  });

  firstMount.unmount();
  const reloadedMount = renderHook(() => useWorkspace(), { wrapper });
  await waitFor(() =>
    expect(reloadedMount.result.current.expandedAgents["checkout-redesign-001-agent-2"]).toBe(true),
  );
});

test("renders the three workspace regions", () => {
  render(<HomePage />);

  expect(screen.getByLabelText("Sidebar")).toBeInTheDocument();
  expect(screen.getByLabelText("Journal")).toBeInTheDocument();
  expect(screen.getByLabelText("Details")).toBeInTheDocument();
});

test("opens the first registered project on a fresh session", async () => {
  const atlas = { id: "atlas", name: "Atlas", path: "/projects/atlas", last_opened_at: "2026-07-29T09:32:40.000Z", available: true };
  const fetchMock = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => [atlas] })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ project: atlas }) });
  global.fetch = fetchMock;
  const mountedWorkspace = renderHook(() => useWorkspace(), { wrapper });

  await waitFor(() => {
    expect(mountedWorkspace.result.current.activeProjectId).toBe("atlas");
    expect(mountedWorkspace.result.current.expandedProjects.atlas).toBe(true);
  });
  expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/projects/open", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({ id: "atlas" }),
  }));
});

test("can reopen a project after mutation responses omit its availability annotation", async () => {
  const atlas = { id: "atlas", name: "Atlas", path: "/projects/atlas", last_opened_at: "2026-07-30T10:00:00.000Z", available: true };
  const borealis = { id: "borealis", name: "Borealis", path: "/projects/borealis", last_opened_at: "2026-07-30T09:00:00.000Z", available: true };
  const rawAtlas = { ...atlas };
  delete rawAtlas.available;
  const rawBorealis = { ...borealis };
  delete rawBorealis.available;
  const fetchMock = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => [atlas, borealis] })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ project: rawAtlas }) })
    .mockResolvedValueOnce({ ok: true, json: async () => [] })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ project: rawBorealis }) })
    .mockResolvedValueOnce({ ok: true, json: async () => [] })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ project: rawAtlas }) })
    .mockResolvedValueOnce({ ok: true, json: async () => [] });
  global.fetch = fetchMock;
  const mountedWorkspace = renderHook(() => useWorkspace(), { wrapper });

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  await act(async () => { await mountedWorkspace.result.current.openProject("borealis"); });
  await act(async () => { await mountedWorkspace.result.current.openProject("atlas"); });

  expect(mountedWorkspace.result.current.activeProjectId).toBe("atlas");
  expect(fetchMock).toHaveBeenCalledTimes(7);
});

test("shows picker launch errors instead of treating them as cancellation", async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => [] })
    .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: "Native picker is unavailable" }) });
  render(
    <WorkspaceProvider>
      <AddProjectButton />
    </WorkspaceProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Add project" }));

  expect(await screen.findByText("Native picker is unavailable")).toBeInTheDocument();
});

test("clears the selected feature when its project is removed", async () => {
  const project = { id: "checkout-redesign", name: "Checkout Redesign", path: "/projects/checkout", last_opened_at: "2026-07-30T10:00:00.000Z", available: true };
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => [project] })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ project: { ...project, available: undefined } }) })
    .mockResolvedValueOnce({ ok: true, json: async () => [mockFeatures[0]] })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
  render(
    <WorkspaceProvider>
      <RemoveActiveProjectButton />
    </WorkspaceProvider>,
  );

  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
  fireEvent.click(screen.getByRole("button", { name: "Remove active project" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove Project" }));

  expect(await screen.findByText("none")).toBeInTheDocument();
});

test("switches between the prototype's journal and board views", () => {
  render(<HomePage />);

  fireEvent.click(screen.getByRole("button", { name: "Switch workspace view" }));
  expect(screen.getByRole("heading", { name: /kanban board/i })).toBeInTheDocument();
});
