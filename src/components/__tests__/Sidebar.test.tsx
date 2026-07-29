import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "atlas", name: "Atlas", path: "/projects/atlas", last_opened_at: "2026-07-29T09:32:40.000Z", available: true },
        { id: "borealis", name: "Borealis", path: "/projects/borealis", last_opened_at: "2026-07-28T09:32:40.000Z", available: true },
      ],
    });
  });

  it("renders registry projects instead of deriving project rows from demo features", async () => {
    renderSidebar();

    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    const project = await screen.findByRole("button", { name: "Atlas" });
    expect(project).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("button", { name: "Checkout Redesign" })).not.toBeInTheDocument();
    expect(screen.getByText("No features found")).toBeInTheDocument();
  });

  it("collapses and reopens agent usage independently", async () => {
    renderSidebar();

    await screen.findByRole("button", { name: "Atlas" });

    const usage = screen.getByRole("button", { name: /agent usage/i });
    expect(usage).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("5h")).toHaveLength(3);

    fireEvent.click(usage);
    expect(usage).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("5h")).not.toBeInTheDocument();

    fireEvent.click(usage);
    expect(screen.getAllByText("5h")).toHaveLength(3);
  });

  it("toggles real registry projects without exposing demo feature rows", async () => {
    renderSidebar();

    const atlas = await screen.findByRole("button", { name: "Atlas" });
    fireEvent.click(atlas);
    expect(atlas).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /cart drawer refactor/i })).not.toBeInTheDocument();
  });

  it("renders unavailable registry projects as disabled and keeps empty projects visible", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "archive", name: "Archive", path: "/projects/archive", last_opened_at: "2026-07-29T09:32:40.000Z", available: true },
        { id: "missing", name: "Missing", path: "/projects/missing", last_opened_at: "2026-07-28T09:32:40.000Z", available: false },
      ],
    });

    renderSidebar();

    await screen.findByRole("button", { name: "Archive" });
    expect(screen.getByText("No features found")).toBeInTheDocument();

    const unavailable = screen.getByRole("button", { name: "Missing" });
    expect(unavailable).toBeDisabled();
    fireEvent.click(unavailable);
    expect(screen.queryByText("No features found")).toBeInTheDocument();
  });

  it("adds the selected project and makes it the active sidebar project", async () => {
    const newProject = { id: "new-project", name: "New Project", path: "/projects/new", last_opened_at: "2026-07-29T10:00:00.000Z", available: true };
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ path: newProject.path }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, project: newProject }) });

    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Add project" }));

    const addedProject = await screen.findByRole("button", { name: "New Project" });
    expect(addedProject).toHaveClass("sidebar-project-toggle--selected");
  });

  it("does not reopen the already active project when toggling its feature list", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "atlas", name: "Atlas", path: "/projects/atlas", last_opened_at: "2026-07-29T09:32:40.000Z", available: true },
      ],
    });
    global.fetch = fetchMock;

    renderSidebar();
    const atlas = await screen.findByRole("button", { name: "Atlas" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.click(atlas);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("opens the project action popover and dismisses it when clicking outside", async () => {
    renderSidebar();

    fireEvent.click(await screen.findByRole("button", { name: "Project actions for Atlas" }));
    expect(screen.getByRole("button", { name: "Edit Project" })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("button", { name: "Edit Project" })).not.toBeInTheDocument();
  });

  it("opens removal confirmation from a project action", async () => {
    renderSidebar();

    fireEvent.click(await screen.findByRole("button", { name: "Project actions for Atlas" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Project" }));

    expect(screen.getByRole("dialog", { name: "Remove Atlas" })).toBeInTheDocument();
    expect(screen.getByText(/Your project files on disk won't be affected/)).toBeInTheDocument();
  });

  it("asks before discarding dirty project edits", async () => {
    renderSidebar();

    fireEvent.click(await screen.findByRole("button", { name: "Project actions for Atlas" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Project" }));
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Atlas Next" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("dialog", { name: "Discard project changes" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("dialog", { name: "Edit Atlas" })).not.toBeInTheDocument();
  });

  it("retains dirty edits when removal is cancelled", async () => {
    renderSidebar();

    fireEvent.click(await screen.findByRole("button", { name: "Project actions for Atlas" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Project" }));
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Atlas Next" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove Project" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByLabelText("Project name")).toHaveValue("Atlas Next");
  });
});
