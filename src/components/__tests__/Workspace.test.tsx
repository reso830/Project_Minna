import { act, render, renderHook, screen, waitFor } from "@testing-library/react";

import HomePage from "../../app/page";
import { WorkspaceProvider, useWorkspace } from "../WorkspaceProvider";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <WorkspaceProvider>{children}</WorkspaceProvider>
);

beforeEach(() => {
  window.sessionStorage.clear();
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
    firstMount.result.current.toggleAgent("checkout-redesign-001-agent-1");
  });

  firstMount.unmount();
  const reloadedMount = renderHook(() => useWorkspace(), { wrapper });
  await waitFor(() =>
    expect(reloadedMount.result.current.expandedAgents["checkout-redesign-001-agent-1"]).toBe(true),
  );
});

test("renders the three workspace regions", () => {
  render(<HomePage />);

  expect(screen.getByLabelText("Sidebar")).toBeInTheDocument();
  expect(screen.getByLabelText("Journal")).toBeInTheDocument();
  expect(screen.getByLabelText("Details")).toBeInTheDocument();
});
