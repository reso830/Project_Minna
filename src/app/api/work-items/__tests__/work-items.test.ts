/** @jest-environment node */

import { access, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GET, POST } from "../route";
import { PATCH } from "../[id]/route";
import { POST as dropWorkItem } from "../[id]/drop/route";
import { openDb } from "../../../../core/db";
import { prepareProject, registerProject } from "../../../../core/registry";
import { readWorkItemEvents, updateWorkItemState } from "../../../../core/work-items";

jest.mock("node:fs/promises", () => {
  const actual = jest.requireActual<typeof import("node:fs/promises")>("node:fs/promises");
  return { ...actual, rename: jest.fn(actual.rename) };
});

const mockedRename = jest.mocked(rename);

afterEach(() => {
  mockedRename.mockClear();
});

async function withProject(run: (project: { id: string; path: string }) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "minna-work-items-api-"));
  const previousRegistryHome = process.env.MINNA_REGISTRY_HOME;
  process.env.MINNA_REGISTRY_HOME = root;
  const project = { id: "checkout", path: join(root, "checkout") };

  try {
    await (await import("node:fs/promises")).mkdir(project.path, { recursive: true });
    await prepareProject(project.path);
    await registerProject({ id: project.id, name: "Checkout", path: project.path, last_opened_at: "2026-08-01T00:00:00.000Z" });
    await run(project);
  } finally {
    if (previousRegistryHome === undefined) delete process.env.MINNA_REGISTRY_HOME;
    else process.env.MINNA_REGISTRY_HOME = previousRegistryHome;
    await rm(root, { recursive: true, force: true });
  }
}

test("creates a slugified work item with a sequential ID and atomic brief file", async () => {
  await withProject(async project => {
    const response = await POST(new Request("http://localhost/api/work-items", {
      method: "POST",
      body: JSON.stringify({ project: project.id, title: "Refund Flow Redesign!", description: "Retries failed payments.", detailsText: "# Refund flow" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      workItem: expect.objectContaining({ id: "001", title: "refund-flow-redesign", feature_brief_path: ".minna/features/001-refund-flow-redesign.md" }),
    }));
    await expect(readFile(join(project.path, ".minna", "features", "001-refund-flow-redesign.md"), "utf8")).resolves.toBe("# Refund flow");
    await expect(access(join(project.path, ".minna", "features", ".001-refund-flow-redesign.tmp"))).rejects.toThrow();

    const listed = await GET(new Request(`http://localhost/api/work-items?project=${project.id}`));
    await expect(listed.json()).resolves.toEqual([expect.objectContaining({ id: "001", title: "refund-flow-redesign" })]);
  });
});

test("updates only mutable work-item details and self-heals an interrupted brief rename", async () => {
  await withProject(async project => {
    await POST(new Request("http://localhost/api/work-items", {
      method: "POST",
      body: JSON.stringify({ project: project.id, title: "Initial Title", description: "Original description.", detailsText: "original" }),
    }));

    const briefDirectory = join(project.path, ".minna", "features");
    await rename(join(briefDirectory, "001-initial-title.md"), join(briefDirectory, ".001-initial-title.tmp"));
    const listed = await GET(new Request(`http://localhost/api/work-items?project=${project.id}`));
    expect((await listed.json())[0]).toEqual(expect.objectContaining({ id: "001", title: "initial-title" }));
    await expect(readFile(join(briefDirectory, "001-initial-title.md"), "utf8")).resolves.toBe("original");

    const response = await PATCH(
      new Request("http://localhost/api/work-items/001", {
        method: "PATCH",
        body: JSON.stringify({ project: project.id, description: "Updated description.", detailsText: "updated" }),
      }),
      { params: Promise.resolve({ id: "001" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      workItem: expect.objectContaining({ id: "001", title: "initial-title", description: "Updated description." }),
    }));
    await expect(readFile(join(briefDirectory, "001-initial-title.md"), "utf8")).resolves.toBe("updated");
  });
});

test("rejects overlong descriptions and returns 404 for an unknown work item", async () => {
  await withProject(async project => {
    const overlong = await POST(new Request("http://localhost/api/work-items", {
      method: "POST",
      body: JSON.stringify({ project: project.id, title: "Too long", description: "x".repeat(101) }),
    }));
    expect(overlong.status).toBe(400);
    await expect(overlong.json()).resolves.toEqual({ error: "Bad Request", message: "Description cannot exceed 100 characters." });

    const missing = await PATCH(
      new Request("http://localhost/api/work-items/999", { method: "PATCH", body: JSON.stringify({ project: project.id, description: "Valid" }) }),
      { params: Promise.resolve({ id: "999" }) },
    );
    expect(missing.status).toBe(404);
  });
});

test("returns the committed work item when the create brief rename is temporarily unavailable", async () => {
  await withProject(async project => {
    mockedRename.mockRejectedValueOnce(new Error("brief file is locked"));

    const response = await POST(new Request("http://localhost/api/work-items", {
      method: "POST",
      body: JSON.stringify({ project: project.id, title: "Locked brief", description: "Database commit must succeed.", detailsText: "brief" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ workItem: expect.objectContaining({ id: "001" }) }));
    await expect(readFile(join(project.path, ".minna", "features", "001-locked-brief.md"), "utf8")).resolves.toBe("brief");
  });
});

test("returns the committed work item when the update brief rename is temporarily unavailable", async () => {
  await withProject(async project => {
    await POST(new Request("http://localhost/api/work-items", {
      method: "POST",
      body: JSON.stringify({ project: project.id, title: "Locked update", description: "Original description.", detailsText: "original" }),
    }));
    mockedRename.mockRejectedValueOnce(new Error("brief file is locked"));

    const response = await PATCH(
      new Request("http://localhost/api/work-items/001", {
        method: "PATCH",
        body: JSON.stringify({ project: project.id, description: "Updated description.", detailsText: "updated" }),
      }),
      { params: Promise.resolve({ id: "001" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ workItem: expect.objectContaining({ description: "Updated description." }) }));
    const listed = await GET(new Request(`http://localhost/api/work-items?project=${project.id}`));
    expect(listed.status).toBe(200);
    await expect(readFile(join(project.path, ".minna", "features", "001-locked-update.md"), "utf8")).resolves.toBe("updated");
  });
});

test("lists an item when a recovery rename is temporarily unavailable", async () => {
  await withProject(async project => {
    await POST(new Request("http://localhost/api/work-items", {
      method: "POST",
      body: JSON.stringify({ project: project.id, title: "Recover later", description: "Recovery retries later.", detailsText: "brief" }),
    }));
    const directory = join(project.path, ".minna", "features");
    await rename(join(directory, "001-recover-later.md"), join(directory, ".001-recover-later.tmp"));
    mockedRename.mockRejectedValueOnce(new Error("brief file is locked"));

    const response = await GET(new Request(`http://localhost/api/work-items?project=${project.id}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([expect.objectContaining({ id: "001", feature_brief_path: ".minna/features/001-recover-later.md" })]);
    await expect(readFile(join(directory, ".001-recover-later.tmp"), "utf8")).resolves.toBe("brief");
  });
});

test("marks a work item when its feature brief is missing", async () => {
  await withProject(async project => {
    await POST(new Request("http://localhost/api/work-items", {
      method: "POST",
      body: JSON.stringify({ project: project.id, title: "Missing brief", description: "Brief was removed.", detailsText: "brief" }),
    }));
    await rm(join(project.path, ".minna", "features", "001-missing-brief.md"));

    const response = await GET(new Request(`http://localhost/api/work-items?project=${project.id}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ id: "001", feature_brief_missing: true }),
    ]);
  });
});

test("drops a work item, preserves its brief, and records the canonical state transition", async () => {
  await withProject(async project => {
    await POST(new Request("http://localhost/api/work-items", {
      method: "POST",
      body: JSON.stringify({ project: project.id, title: "Obsolete feature", description: "No longer needed.", detailsText: "keep this brief" }),
    }));

    const response = await dropWorkItem(
      new Request("http://localhost/api/work-items/001/drop", { method: "POST", body: JSON.stringify({ project: project.id }) }),
      { params: Promise.resolve({ id: "001" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      workItem: expect.objectContaining({ id: "001", state: "closed", closed_reason: "dropped" }),
    }));
    await expect(readFile(join(project.path, ".minna", "features", "001-obsolete-feature.md"), "utf8")).resolves.toBe("keep this brief");

    const db = openDb(join(project.path, ".minna", "minna.db"));
    try {
      const events = await readWorkItemEvents(db, "001");
      expect(events.at(-1)).toEqual(expect.objectContaining({
        type: "work_item.state_changed",
        payload: { from: "parked", to: "closed", phase: "spec", blocked_reason: null, closed_reason: "dropped" },
      }));
    } finally {
      db.close();
    }
  });
});

test("rejects dropping an already closed work item", async () => {
  await withProject(async project => {
    await POST(new Request("http://localhost/api/work-items", {
      method: "POST",
      body: JSON.stringify({ project: project.id, title: "Already closed", description: "Close once." }),
    }));
    await dropWorkItem(
      new Request("http://localhost/api/work-items/001/drop", { method: "POST", body: JSON.stringify({ project: project.id }) }),
      { params: Promise.resolve({ id: "001" }) },
    );

    const response = await dropWorkItem(
      new Request("http://localhost/api/work-items/001/drop", { method: "POST", body: JSON.stringify({ project: project.id }) }),
      { params: Promise.resolve({ id: "001" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Bad Request", message: "Cannot drop work item in terminal state 'closed'." });
  });
});

test("returns 404 when dropping an unknown work item", async () => {
  await withProject(async project => {
    const response = await dropWorkItem(
      new Request("http://localhost/api/work-items/999/drop", { method: "POST", body: JSON.stringify({ project: project.id }) }),
      { params: Promise.resolve({ id: "999" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not Found", message: "Work item with ID '999' not found." });
  });
});

test("preserves an existing closed reason during later state updates", async () => {
  await withProject(async project => {
    await POST(new Request("http://localhost/api/work-items", {
      method: "POST",
      body: JSON.stringify({ project: project.id, title: "Completed item", description: "Keep original closure." }),
    }));
    const db = openDb(join(project.path, ".minna", "minna.db"));
    try {
      await updateWorkItemState(db, "human", "001", { state: "closed", closed_reason: "done" });
      const updated = await updateWorkItemState(db, "human", "001", { state: "closed", closed_reason: "dropped" });
      expect(updated.closed_reason).toBe("done");
    } finally {
      db.close();
    }
  });
});
