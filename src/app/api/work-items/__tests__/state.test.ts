/** @jest-environment node */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { POST } from "../route";
import { PATCH as transitionState } from "../[id]/state/route";
import { prepareProject, registerProject } from "../../../../core/registry";

async function withProject(run: (project: { id: string; path: string }) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "minna-state-api-"));
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

async function createWorkItem(project: { id: string }) {
  await POST(new Request("http://localhost/api/work-items", {
    method: "POST",
    body: JSON.stringify({ project: project.id, title: "State transition", description: "Valid state transition." }),
  }));
}

test("transitions a work item through the unified state endpoint", async () => {
  await withProject(async project => {
    await createWorkItem(project);

    const response = await transitionState(
      new Request("http://localhost/api/work-items/001/state", {
        method: "PATCH",
        body: JSON.stringify({ project: project.id, state: "active" }),
      }),
      { params: Promise.resolve({ id: "001" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ id: "001", state: "active", closed_reason: null }));
  });
});

test("returns structured 422 details for an illegal transition", async () => {
  await withProject(async project => {
    await createWorkItem(project);

    const response = await transitionState(
      new Request("http://localhost/api/work-items/001/state", {
        method: "PATCH",
        body: JSON.stringify({ project: project.id, state: "blocked", blocked_reason: "ci-pending" }),
      }),
      { params: Promise.resolve({ id: "001" }) },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Illegal state transition from 'parked' to 'blocked'.",
      from: "parked",
      to: "blocked",
      allowed: ["active", "closed"],
    });
  });
});

test("rejects every same-state request as an illegal transition", async () => {
  await withProject(async project => {
    const cases = [
      { state: "parked", setup: [] },
      { state: "active", setup: ["active"] },
      { state: "blocked", setup: ["active", "blocked"] },
      { state: "closed", setup: ["closed"] },
    ] as const;

    for (const [index, testCase] of cases.entries()) {
      await createWorkItem(project);
      const id = String(index + 1).padStart(3, "0");
      for (const state of testCase.setup) {
        const setupResponse = await transitionState(
          new Request(`http://localhost/api/work-items/${id}/state`, {
            method: "PATCH",
            body: JSON.stringify({
              project: project.id,
              state,
              ...(state === "blocked" ? { blocked_reason: "ci-pending" } : {}),
              ...(state === "closed" ? { closed_reason: "done" } : {}),
            }),
          }),
          { params: Promise.resolve({ id }) },
        );
        expect(setupResponse.status).toBe(200);
      }

      const response = await transitionState(
        new Request(`http://localhost/api/work-items/${id}/state`, {
          method: "PATCH",
          body: JSON.stringify({
            project: project.id,
            state: testCase.state,
            ...(testCase.state === "blocked" ? { blocked_reason: "ci-pending" } : {}),
            ...(testCase.state === "closed" ? { closed_reason: "done" } : {}),
          }),
        }),
        { params: Promise.resolve({ id }) },
      );

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual(expect.objectContaining({
        from: testCase.state,
        to: testCase.state,
      }));
    }
  });
});

test("rejects malformed transition requests", async () => {
  const missingProject = await transitionState(
    new Request("http://localhost/api/work-items/001/state", { method: "PATCH", body: JSON.stringify({ state: "active" }) }),
    { params: Promise.resolve({ id: "001" }) },
  );
  expect(missingProject.status).toBe(400);
  await expect(missingProject.json()).resolves.toEqual({ error: "Missing required field: project" });

  await withProject(async project => {
    await createWorkItem(project);
    const missingReason = await transitionState(
      new Request("http://localhost/api/work-items/001/state", {
        method: "PATCH",
        body: JSON.stringify({ project: project.id, state: "closed" }),
      }),
      { params: Promise.resolve({ id: "001" }) },
    );
    expect(missingReason.status).toBe(400);
    await expect(missingReason.json()).resolves.toEqual({ error: "closed_reason is required when state is 'closed'." });

    const invalidBlockedReason = await transitionState(
      new Request("http://localhost/api/work-items/001/state", {
        method: "PATCH",
        body: JSON.stringify({ project: project.id, state: "active" }),
      }),
      { params: Promise.resolve({ id: "001" }) },
    );
    expect(invalidBlockedReason.status).toBe(200);

    const invalidBlockedTransition = await transitionState(
      new Request("http://localhost/api/work-items/001/state", {
        method: "PATCH",
        body: JSON.stringify({ project: project.id, state: "blocked", blocked_reason: "not-a-reason" }),
      }),
      { params: Promise.resolve({ id: "001" }) },
    );
    expect(invalidBlockedTransition.status).toBe(400);
    await expect(invalidBlockedTransition.json()).resolves.toEqual({
      error: "blocked_reason must be one of: clarification-required, approval-required, external-dependency, ci-pending, failed.",
    });
  });
});
