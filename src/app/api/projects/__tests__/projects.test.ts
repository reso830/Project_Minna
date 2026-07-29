/** @jest-environment node */

import { stat } from "node:fs/promises";
import { resolve } from "node:path";

import { POST as addProject } from "../add/route";
import { POST as editProject } from "../edit/route";
import { POST as openProject } from "../open/route";
import { POST as removeProject } from "../remove/route";
import { DirectoryPickerCancelledError, pickDirectory } from "../../../../core/native-directory-picker";
import { GET as listProjects } from "../route";
import {
  listRegisteredProjects,
  openRegisteredProject,
  prepareProject,
  registerProject,
  removeProject as removeRegisteredProject,
  updateProject,
  verifyProjectHealth,
} from "../../../../core/registry";

jest.mock("node:fs/promises", () => ({
  stat: jest.fn(),
}));

jest.mock("../../../../core/registry", () => ({
  listRegisteredProjects: jest.fn(),
  openRegisteredProject: jest.fn(),
  prepareProject: jest.fn(),
  registerProject: jest.fn(),
  removeProject: jest.fn(),
  updateProject: jest.fn(),
  verifyProjectHealth: jest.fn(),
}));

const mockedStat = jest.mocked(stat);
const mockedListRegisteredProjects = jest.mocked(listRegisteredProjects);
const mockedOpenRegisteredProject = jest.mocked(openRegisteredProject);
const mockedPrepareProject = jest.mocked(prepareProject);
const mockedRegisterProject = jest.mocked(registerProject);
const mockedRemoveRegisteredProject = jest.mocked(removeRegisteredProject);
const mockedUpdateProject = jest.mocked(updateProject);
const mockedVerifyProjectHealth = jest.mocked(verifyProjectHealth);

const checkout = {
  id: "checkout-redesign",
  name: "Checkout_Redesign",
  path: "/projects/Checkout_Redesign",
  last_opened_at: "2026-07-29T09:32:40.000Z",
};

beforeEach(() => {
  jest.resetAllMocks();
});

test("returns the registry's current health annotations", async () => {
  mockedListRegisteredProjects.mockResolvedValue([
    { ...checkout, available: true },
    { ...checkout, id: "missing", name: "Missing", path: "/projects/Missing", available: false },
  ]);

  const response = await listProjects();

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual([
    { ...checkout, available: true },
    { ...checkout, id: "missing", name: "Missing", path: "/projects/Missing", available: false },
  ]);
});

test("adds a selected directory after preparing its local Minna files", async () => {
  mockedStat.mockResolvedValue({ isDirectory: () => true } as Awaited<ReturnType<typeof stat>>);
  mockedPrepareProject.mockResolvedValue({ initialized: true });
  mockedListRegisteredProjects.mockResolvedValue([]);
  mockedRegisterProject.mockImplementation(async (project) => project);

  const response = await addProject(new Request("http://localhost/api/projects/add", {
    method: "POST",
    body: JSON.stringify({ path: "/projects/Checkout_Redesign" }),
  }));

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ success: true, project: expect.objectContaining({
    id: "checkout-redesign",
    name: "Checkout_Redesign",
    path: resolve("/projects/Checkout_Redesign"),
  }) });
  expect(mockedPrepareProject).toHaveBeenCalledWith(resolve("/projects/Checkout_Redesign"));
});

test("reopens an already registered path without appending another registration", async () => {
  const knownProject = { ...checkout, path: resolve(checkout.path) };
  mockedListRegisteredProjects.mockResolvedValue([knownProject]);
  mockedStat.mockResolvedValue({ isDirectory: () => true } as Awaited<ReturnType<typeof stat>>);
  mockedPrepareProject.mockResolvedValue({ initialized: false });
  mockedOpenRegisteredProject.mockResolvedValue({
    ...knownProject,
    last_opened_at: "2026-07-29T10:00:00.000Z",
  });

  const response = await addProject(new Request("http://localhost/api/projects/add", {
    method: "POST",
    body: JSON.stringify({ path: checkout.path }),
  }));

  await expect(response.json()).resolves.toEqual({
    success: true,
    project: expect.objectContaining({ id: checkout.id, path: resolve(checkout.path) }),
  });
  expect(mockedOpenRegisteredProject).toHaveBeenCalled();
  expect(mockedRegisterProject).not.toHaveBeenCalled();
});

test("does not register a selected path that is not a directory", async () => {
  mockedStat.mockResolvedValue({ isDirectory: () => false } as Awaited<ReturnType<typeof stat>>);

  const response = await addProject(new Request("http://localhost/api/projects/add", {
    method: "POST",
    body: JSON.stringify({ path: "/projects/not-a-directory" }),
  }));

  expect(response.status).toBe(400);
  expect(mockedPrepareProject).not.toHaveBeenCalled();
  expect(mockedRegisterProject).not.toHaveBeenCalled();
});

test("returns 404 when opening an unregistered project", async () => {
  mockedListRegisteredProjects.mockResolvedValue([]);

  const response = await openProject(new Request("http://localhost/api/projects/open", {
    method: "POST",
    body: JSON.stringify({ id: "unknown" }),
  }));

  expect(response.status).toBe(404);
  expect(mockedOpenRegisteredProject).not.toHaveBeenCalled();
});

test("returns 410 when opening a project whose path is unavailable", async () => {
  mockedListRegisteredProjects.mockResolvedValue([checkout]);
  mockedVerifyProjectHealth.mockResolvedValue({ available: false, error: "Missing config.yaml" });

  const response = await openProject(new Request("http://localhost/api/projects/open", {
    method: "POST",
    body: JSON.stringify({ id: checkout.id }),
  }));

  expect(response.status).toBe(410);
  expect(mockedOpenRegisteredProject).not.toHaveBeenCalled();
});

test("opens a healthy project by recreating its missing local database before recording the open", async () => {
  mockedListRegisteredProjects.mockResolvedValue([checkout]);
  mockedVerifyProjectHealth.mockResolvedValue({ available: true });
  mockedPrepareProject.mockResolvedValue({ initialized: false });
  mockedOpenRegisteredProject.mockResolvedValue(checkout);

  const response = await openProject(new Request("http://localhost/api/projects/open", {
    method: "POST",
    body: JSON.stringify({ id: checkout.id }),
  }));

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ success: true, project: checkout });
  expect(mockedPrepareProject).toHaveBeenCalledWith(checkout.path);
});

test("rejects an edit when the relocation path has invalid project configuration", async () => {
  mockedListRegisteredProjects.mockResolvedValue([checkout]);
  mockedVerifyProjectHealth.mockResolvedValue({ available: false, error: "Missing config.yaml" });

  const response = await editProject(new Request("http://localhost/api/projects/edit", {
    method: "POST",
    body: JSON.stringify({ id: checkout.id, name: "Checkout v2", path: "/projects/Checkout-v2" }),
  }));

  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual({ error: "Validation Failure", details: "Missing config.yaml" });
  expect(mockedUpdateProject).not.toHaveBeenCalled();
});

test("rejects an edit when the relocation path is already registered", async () => {
  mockedListRegisteredProjects.mockResolvedValue([checkout]);
  mockedVerifyProjectHealth.mockResolvedValue({ available: true });
  mockedUpdateProject.mockRejectedValue(new Error("This directory is already registered as project 'Other'."));

  const response = await editProject(new Request("http://localhost/api/projects/edit", {
    method: "POST",
    body: JSON.stringify({ id: checkout.id, name: checkout.name, path: "/projects/Other" }),
  }));

  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual({
    error: "Validation Failure",
    details: "This directory is already registered as project 'Other'.",
  });
});

test("removes a registered project without delegating any filesystem action", async () => {
  mockedRemoveRegisteredProject.mockResolvedValue();

  const response = await removeProject(new Request("http://localhost/api/projects/remove", {
    method: "POST",
    body: JSON.stringify({ id: checkout.id }),
  }));

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ success: true });
  expect(mockedRemoveRegisteredProject).toHaveBeenCalledWith(checkout.id);
});

test("reports picker cancellation without treating it as a server failure", async () => {
  await expect(pickDirectory("linux", async () => ({ stdout: "", stderr: "" }))).rejects.toEqual(
    new DirectoryPickerCancelledError("Directory picker was cancelled by the user."),
  );
});

test("uses the Windows folder browser command and returns the selected path", async () => {
  const path = await pickDirectory("win32", async (command, args) => {
    expect(command).toBe("powershell.exe");
    expect(args).toEqual(expect.arrayContaining(["-NoProfile", "-STA", "-Command"]));
    return { stdout: "C:\\Projects\\Minna\n", stderr: "" };
  });

  expect(path).toBe("C:\\Projects\\Minna");
});

test("treats a Linux picker cancellation exit as a cancellation", async () => {
  await expect(pickDirectory("linux", async () => {
    throw Object.assign(new Error("cancelled"), { code: 1 });
  })).rejects.toBeInstanceOf(DirectoryPickerCancelledError);
});
