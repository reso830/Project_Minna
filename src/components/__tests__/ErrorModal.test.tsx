import { fireEvent, render, screen } from "@testing-library/react";

import { ErrorModal } from "../ErrorModal";
import { Sidebar } from "../Sidebar";
import { WorkspaceProvider } from "../WorkspaceProvider";

test("renders validation details in a modal and dismisses without reaching the backdrop", () => {
  const dismiss = jest.fn();
  const backgroundClick = jest.fn();
  render(
    <>
      <button onClick={backgroundClick} type="button">Background action</button>
      <ErrorModal details="Project rejection: Missing config.yaml in existing .minna directory." onDismiss={dismiss} />
    </>,
  );

  expect(screen.getByRole("dialog", { name: "Project validation failed" })).toHaveAttribute("aria-modal", "true");
  expect(screen.getByText(/missing config\.yaml/i)).toBeInTheDocument();

  fireEvent.click(screen.getByTestId("error-modal-backdrop"));
  expect(backgroundClick).not.toHaveBeenCalled();
  expect(dismiss).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  expect(dismiss).toHaveBeenCalledTimes(1);
});

test("keeps keyboard focus inside the modal", () => {
  render(
    <>
      <button type="button">Background action</button>
      <ErrorModal details="Project rejection" onDismiss={() => {}} />
    </>,
  );

  const background = screen.getByRole("button", { name: "Background action" });
  background.focus();
  fireEvent.keyDown(document, { key: "Tab" });

  expect(screen.getByRole("button", { name: "Dismiss" })).toHaveFocus();
});

test("shows an add-project validation response and unlocks the workspace on dismissal", async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => [] })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ path: "/projects/corrupt" }) })
    .mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Validation Failure", details: "Project rejection: Missing config.yaml in existing .minna directory." }),
    });

  render(
    <WorkspaceProvider>
      <Sidebar />
    </WorkspaceProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Add project" }));

  expect(await screen.findByRole("dialog", { name: "Project validation failed" })).toHaveTextContent("Missing config.yaml");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  expect(screen.queryByRole("dialog", { name: "Project validation failed" })).not.toBeInTheDocument();
});

test("shows filesystem failures returned by Add Project", async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => [] })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ path: "/projects/protected" }) })
    .mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal Server Error", details: "Permission denied writing to /projects/protected/.minna/config.yaml" }),
    });

  render(
    <WorkspaceProvider>
      <Sidebar />
    </WorkspaceProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Add project" }));

  expect(await screen.findByRole("dialog", { name: "Project validation failed" })).toHaveTextContent("Permission denied");
});
