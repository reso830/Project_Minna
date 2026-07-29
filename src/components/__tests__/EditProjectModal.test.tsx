import { fireEvent, render, screen } from "@testing-library/react";

import { EditProjectModal } from "../EditProjectModal";
import { DiscardConfirmModal } from "../DiscardConfirmModal";
import { RemoveConfirmModal } from "../RemoveConfirmModal";

const project = {
  id: "atlas",
  name: "Atlas",
  path: "/projects/atlas",
  last_opened_at: "2026-07-29T09:32:40.000Z",
  available: true,
};

test("keeps Save disabled until the project name or path changes", () => {
  render(
    <EditProjectModal
      onCancel={jest.fn()}
      onRemove={jest.fn()}
      onSave={jest.fn()}
      onSelectPath={jest.fn()}
      project={project}
    />,
  );

  const save = screen.getByRole("button", { name: "Save" });
  expect(save).toBeDisabled();

  fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Atlas Redesign" } });
  expect(save).toBeEnabled();
});

test("uses the native picker callback before saving the relocated project", async () => {
  const selectPath = jest.fn().mockResolvedValue("/projects/atlas-next");
  const save = jest.fn();
  render(<EditProjectModal onCancel={jest.fn()} onRemove={jest.fn()} onSave={save} onSelectPath={selectPath} project={project} />);

  fireEvent.click(screen.getByRole("button", { name: "Select project directory" }));
  await screen.findByText("/projects/atlas-next");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  expect(save).toHaveBeenCalledWith("Atlas", "/projects/atlas-next");
});

test("offers removal and marks a dirty cancellation for confirmation", () => {
  const onCancel = jest.fn();
  const onRemove = jest.fn();
  render(<EditProjectModal onCancel={onCancel} onRemove={onRemove} onSave={jest.fn()} onSelectPath={jest.fn()} project={project} />);

  fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Atlas Redesign" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove Project" }));

  expect(onCancel).toHaveBeenCalledWith(true);
  expect(onRemove).toHaveBeenCalledTimes(1);
});

test("keeps keyboard focus inside the edit dialog", () => {
  render(<EditProjectModal onCancel={jest.fn()} onRemove={jest.fn()} onSave={jest.fn()} onSelectPath={jest.fn()} project={project} />);

  const dialog = screen.getByRole("dialog", { name: "Edit Atlas" });
  expect(dialog).toContainElement(document.activeElement);
  fireEvent.keyDown(document, { key: "Tab" });
  expect(dialog).toContainElement(document.activeElement);
});

test("keeps keyboard focus inside the remove confirmation", () => {
  render(<RemoveConfirmModal name="Atlas" onCancel={jest.fn()} onRemove={jest.fn()} />);

  const dialog = screen.getByRole("dialog", { name: "Remove Atlas" });
  expect(dialog).toContainElement(document.activeElement);
  fireEvent.keyDown(document, { key: "Tab" });
  expect(dialog).toContainElement(document.activeElement);
});

test("keeps keyboard focus inside the discard confirmation", () => {
  render(<DiscardConfirmModal onDiscard={jest.fn()} onKeepEditing={jest.fn()} />);

  const dialog = screen.getByRole("dialog", { name: "Discard project changes" });
  expect(dialog).toContainElement(document.activeElement);
  fireEvent.keyDown(document, { key: "Tab" });
  expect(dialog).toContainElement(document.activeElement);
});
