import { fireEvent, render, screen } from "@testing-library/react";
import { Sidebar } from "../Sidebar";
import { WorkspaceProvider } from "../WorkspaceProvider";

function renderSidebar() {
  return render(
    <WorkspaceProvider>
      <Sidebar />
    </WorkspaceProvider>,
  );
}

describe("Sidebar", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("expands projects and selects a feature", () => {
    renderSidebar();

    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    const project = screen.getByRole("button", { name: "Checkout Redesign" });
    expect(project).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(project);
    expect(project).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(project);
    expect(project).toHaveAttribute("aria-expanded", "true");

    const feature = screen.getByRole("button", { name: /cart drawer refactor/i });
    expect(feature).toHaveTextContent("001Cart drawer refactor");
    fireEvent.click(feature);
    expect(feature).toHaveAttribute("aria-pressed", "true");
    expect(project).toHaveClass("sidebar-project-toggle--selected");
  });

  it("collapses and reopens agent usage independently", () => {
    renderSidebar();

    const usage = screen.getByRole("button", { name: /agent usage/i });
    expect(usage).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("5h")).toHaveLength(3);

    fireEvent.click(usage);
    expect(usage).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("5h")).not.toBeInTheDocument();

    fireEvent.click(usage);
    expect(screen.getAllByText("5h")).toHaveLength(3);
  });

  it("announces each feature state and identifies collapsed projects with blockers", () => {
    renderSidebar();

    const checkout = screen.getByRole("button", { name: "Checkout Redesign" });
    fireEvent.click(checkout);

    expect(checkout).toHaveClass("sidebar-project-toggle--blocked");
    fireEvent.click(checkout);

    expect(screen.getByRole("button", { name: "Cart drawer refactor, active" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Payment retries, blocked" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Billing v2" })).toHaveClass(
      "sidebar-project-toggle--blocked",
    );
  });
});
