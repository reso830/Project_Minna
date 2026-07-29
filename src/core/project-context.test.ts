import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { parse } from "yaml";
import { listRegisteredProjects, type ProjectRegistryPaths } from "./registry.js";
import { resolveProjectContext, syncProjectContext } from "./project-context.js";

async function withProject(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "minna-project-context-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function registryPaths(directory: string): ProjectRegistryPaths {
  return {
    databasePath: join(directory, "registry", "projects.db"),
    exportPath: join(directory, "registry", "projects.json"),
  };
}

test("walks parent directories to resolve .minna/config.yaml", async () => {
  await withProject(async directory => {
    const nestedDirectory = join(directory, "src", "deep");
    await mkdir(nestedDirectory, { recursive: true });
    await mkdir(join(directory, ".minna"));
    await writeFile(join(directory, ".minna", "config.yaml"), "version: 1\ncreated_at: 2026-07-29T10:00:00.000Z\ndescription: null\n", "utf8");

    const context = await resolveProjectContext({ cwd: nestedDirectory });

    assert.equal(context.key, basename(directory));
    assert.equal(context.project.name, basename(directory));
    assert.equal(context.project.path, directory);
    assert.equal(context.project.speckit_dir, ".specify");
  });
});

test("migrates legacy configuration at a parent directory and preserves optional values", async () => {
  await withProject(async directory => {
    const legacyPath = join(directory, "minna.project.yaml");
    await writeFile(
      legacyPath,
      "project:\n  key: old-key\n  speckit_dir: custom-specs\n  github: org/repo\n  default_branch: trunk\n",
      "utf8",
    );
    const expectedCreatedAt = (await stat(legacyPath)).birthtime.toISOString();
    const nestedDirectory = join(directory, "child");
    await mkdir(nestedDirectory);

    const context = await resolveProjectContext({ cwd: nestedDirectory });
    const migrated = parse(await readFile(join(directory, ".minna", "config.yaml"), "utf8")) as Record<string, unknown>;

    assert.equal(context.key, basename(directory));
    assert.equal(context.project.speckit_dir, "custom-specs");
    assert.equal(context.project.github, "org/repo");
    assert.equal(context.project.default_branch, "trunk");
    assert.deepEqual(migrated, {
      version: 1,
      created_at: expectedCreatedAt,
      description: null,
      speckit_dir: "custom-specs",
      github: "org/repo",
      default_branch: "trunk",
    });
    await assert.rejects(() => access(legacyPath));
  });
});

test("synchronizes a resolved project with the registry and records reopens", async () => {
  await withProject(async directory => {
    await mkdir(join(directory, ".minna"));
    await writeFile(join(directory, ".minna", "config.yaml"), "version: 1\ncreated_at: 2026-07-29T10:00:00.000Z\ndescription: null\n", "utf8");
    const context = await resolveProjectContext({ cwd: directory });
    const paths = registryPaths(directory);

    await syncProjectContext(context, paths);
    await syncProjectContext(context, paths);

    await access(join(directory, ".minna", "minna.db"));
    assert.deepEqual((await listRegisteredProjects(paths)).map(project => ({
      id: project.id,
      name: project.name,
      path: project.path,
    })), [{ id: basename(directory).toLowerCase(), name: basename(directory), path: directory }]);
    const database = new DatabaseSync(paths.databasePath);
    try {
      assert.deepEqual((database.prepare("SELECT type FROM events ORDER BY id").all() as Array<{ type: string }>).map(event => event.type), [
        "project.registered",
        "project.opened",
      ]);
    } finally {
      database.close();
    }
  });
});
