import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { resolveProjectContext } from "./project-context.js";

test("resolves embedded project config from minna.project.yaml", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-embedded-"));

  try {
    await writeFile(
      join(dir, "minna.project.yaml"),
      [
        "project:",
        "  key: monica",
        "  name: Project_Monica",
        "  path: .",
        "  github: reso830/Project_Monica",
        "  speckit_dir: .specify",
        "  default_branch: main",
        ""
      ].join("\n"),
      "utf8"
    );

    const context = await resolveProjectContext({ cwd: dir });

    assert.equal(context.mode, "embedded");
    assert.equal(context.key, "monica");
    assert.equal(context.project.name, "Project_Monica");
    assert.equal(context.project.path, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("resolves central project config by key", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-central-"));

  try {
    const projectPath = join(dir, "Project_Monica");
    await writeFile(
      join(dir, "projects.yaml"),
      [
        "projects:",
        "  monica:",
        "    name: Project_Monica",
        `    path: ${projectPath.replaceAll("\\", "/")}`,
        "    github: reso830/Project_Monica",
        "    speckit_dir: .specify",
        ""
      ].join("\n"),
      "utf8"
    );

    const context = await resolveProjectContext({ cwd: dir, projectKey: "monica" });

    assert.equal(context.mode, "central");
    assert.equal(context.key, "monica");
    assert.equal(context.project.path, projectPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("resolves relative central project paths from projects.yaml location", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-central-relative-"));

  try {
    await writeFile(
      join(dir, "projects.yaml"),
      [
        "projects:",
        "  monica:",
        "    name: Project_Monica",
        "    path: ./Project_Monica",
        "    speckit_dir: .specify",
        ""
      ].join("\n"),
      "utf8"
    );

    const context = await resolveProjectContext({ cwd: dir, projectKey: "monica" });

    assert.equal(context.mode, "central");
    assert.equal(context.project.path, join(dir, "Project_Monica"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("requires a project key when no embedded config exists", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-missing-"));

  try {
    await assert.rejects(
      resolveProjectContext({ cwd: dir }),
      /No project selected/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
