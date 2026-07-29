/** @jest-environment node */

import { stat } from "node:fs/promises";
import { resolve } from "node:path";

import { POST as addProject } from "../add/route";
import { POST as openProject } from "../open/route";
import { DirectoryPickerCancelledError, pickDirectory } from "../../../../core/native-directory-picker";
import { GET as listProjects } from "../route";
import {
  listRegisteredProjects,
  openRegisteredProject,
  prepareProject,
  registerProject,
} from "../../../../core/registry";

jest.mock("node:fs/promises", () => ({
  stat: jest.fn(),
}));

jest.mock("../../../../core/registry", () => ({
  listRegisteredProjects: jest.fn(),
  openRegisteredProject: jest.fn(),
  prepareProject: jest.fn(),
  registerProject: jest.fn(),
}));

const mockedStat = jest.mocked(stat);
const mockedListRegisteredProjects = jest.mocked(listRegisteredProjects);
const mockedOpenRegisteredProject = jest.mocked(openRegisteredProject);
const mockedPrepareProject = jest.mocked(prepareProject);
const mockedRegisterProject = jest.mocked(registerProject);

const checkout = {
  id: "checkout-redesign",
  name: "Checkout_Redesign",
  path: "/projects/Checkout_Redesign",
  last_opened_at: "2026-07-29T09:32:40.000Z",
};

beforeEach(() => {
  jest.resetAllMocks();
});

test("lists registered projects with their current filesystem availability", async () => {
  mockedListRegisteredProjects.mockResolvedValue([
    checkout,
    { ...checkout, id: "missing", name: "Missing", path: "/projects/Missing" },
  ]);
  mockedStat.mockImplementation(async (path) => {
    if (path === checkout.path) return { isDirectory: () => true } as Awaited<ReturnType<typeof stat>>;
    throw Object.assign(new Error("missing"), { code: "ENOENT" });
  });

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
  mockedStat.mockRejectedValue(Object.assign(new Error("missing"), { code: "ENOENT" }));

  const response = await openProject(new Request("http://localhost/api/projects/open", {
    method: "POST",
    body: JSON.stringify({ id: checkout.id }),
  }));

  expect(response.status).toBe(410);
  expect(mockedOpenRegisteredProject).not.toHaveBeenCalled();
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
