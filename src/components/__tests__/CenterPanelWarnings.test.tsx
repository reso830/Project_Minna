import { act, fireEvent, render, screen } from "@testing-library/react";

import { mockFeatures } from "../../core/mockData";
import { CenterPanel } from "../CenterPanel";

const mockUseWorkspace = jest.fn();

jest.mock("../WorkspaceProvider", () => ({
  useWorkspace: () => mockUseWorkspace(),
}));

describe("CenterPanel feature brief warning", () => {
  beforeEach(() => {
    const feature = { ...mockFeatures[0]!, feature_brief_missing: true };
    mockUseWorkspace.mockReturnValue({
      activeFeatureId: feature.id,
      events: {},
      features: [feature],
      resolvedDecisions: {},
      submitDecision: jest.fn(),
      submitReply: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders a recovery warning when the selected feature brief is missing", () => {
    render(<CenterPanel />);

    expect(screen.getByText("Warning: Feature brief not found. Click edit to recreate or attach a new brief.")).toBeInTheDocument();
  });

  it("keeps details open while the pointer crosses the recovery warning", () => {
    jest.useFakeTimers();
    render(<CenterPanel />);

    const detailsControl = screen.getByRole("button", { name: "Show details" });
    fireEvent.mouseEnter(detailsControl);
    fireEvent.mouseLeave(detailsControl);
    fireEvent.mouseEnter(screen.getByText("Warning: Feature brief not found. Click edit to recreate or attach a new brief."));

    act(() => {
      jest.advanceTimersByTime(150);
    });

    expect(screen.getByLabelText("Feature details")).toBeInTheDocument();
  });
});
