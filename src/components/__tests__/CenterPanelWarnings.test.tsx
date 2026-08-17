import { render, screen } from "@testing-library/react";

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

  it("renders a recovery warning when the selected feature brief is missing", () => {
    render(<CenterPanel />);

    expect(screen.getByText("Warning: Feature brief not found. Click edit to recreate or attach a new brief.")).toBeInTheDocument();
  });
});
