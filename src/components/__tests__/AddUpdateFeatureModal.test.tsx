import { fireEvent, render, screen } from "@testing-library/react";

import { AddUpdateFeatureModal } from "../AddUpdateFeatureModal";
import { DiscardFeatureConfirmModal } from "../DiscardConfirmModal";

test("enforces feature field limits and enables Save only after a change", () => {
  const onSave = jest.fn();
  render(<AddUpdateFeatureModal mode="create" nextId="001" onCancel={jest.fn()} onDrop={jest.fn()} onSave={onSave} projectName="Atlas" />);

  const save = screen.getByRole("button", { name: "Save" });
  expect(save).toBeDisabled();
  const title = screen.getByLabelText("Feature title");
  const description = screen.getByLabelText("Feature description");
  expect(title).toHaveAttribute("maxLength", "50");
  expect(description).toHaveAttribute("maxLength", "100");

  fireEvent.change(title, { target: { value: "Refund flow" } });
  fireEvent.change(description, { target: { value: "Retry failed payments" } });
  expect(save).toBeEnabled();
  fireEvent.click(save);
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "Refund flow", description: "Retry failed payments" }));
});

test("preserves typed details while switching attachment tabs", () => {
  render(<AddUpdateFeatureModal mode="create" nextId="001" onCancel={jest.fn()} onDrop={jest.fn()} onSave={jest.fn()} projectName="Atlas" />);

  fireEvent.change(screen.getByLabelText("Feature details"), { target: { value: "Detailed brief" } });
  fireEvent.click(screen.getByRole("tab", { name: "Attach MD file" }));
  fireEvent.click(screen.getByRole("tab", { name: "Type here" }));
  expect(screen.getByLabelText("Feature details")).toHaveValue("Detailed brief");
});

test("requests a discard confirmation for dirty feature edits", () => {
  const onCancel = jest.fn();
  render(<AddUpdateFeatureModal mode="create" nextId="001" onCancel={onCancel} onDrop={jest.fn()} onSave={jest.fn()} projectName="Atlas" />);

  fireEvent.change(screen.getByLabelText("Feature title"), { target: { value: "Refund flow" } });
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  expect(onCancel).toHaveBeenCalledWith(true);
});

test("confirms or cancels feature discard", () => {
  const onDiscard = jest.fn();
  const onKeepEditing = jest.fn();
  render(<DiscardFeatureConfirmModal onDiscard={onDiscard} onKeepEditing={onKeepEditing} />);

  expect(screen.getByRole("dialog", { name: "Discard this feature?" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Keep Editing" }));
  expect(onKeepEditing).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  expect(onDiscard).toHaveBeenCalledTimes(1);
});
