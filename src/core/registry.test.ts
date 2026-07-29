import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  initializeProjectRegistry,
  listRegisteredProjects,
  openRegisteredProject,
  prepareProject,
  registerProject,
  type ProjectRegistryPaths,
} from "./registry.js";
import type { ProjectRegistryEntry } from "./types.js";

async function withRegistry(run: (paths: ProjectRegistryPaths) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "minna-project-registry-"));
  const paths = {
    databasePath: join(directory, "registry", "projects.db"),
    exportPath: join(directory, "registry", "projects.json"),
  };

  try {
    await run(paths);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function runRegistryWriter(paths: ProjectRegistryPaths, project: {
  id: string;
  name: string;
  path: string;
  last_opened_at: string;
}): Promise<void> {
  const registryModule = pathToFileURL(join(process.cwd(), "dist", "core", "registry.js")).href;
  const script = [
    `import { registerProject } from ${JSON.stringify(registryModule)};`,
    `await registerProject(${JSON.stringify(project)}, ${JSON.stringify(paths)});`,
  ].join("\n");

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "--eval", script]);
    let stderr = "";
    child.stderr.on("data", chunk => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("exit", code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `registry writer exited with code ${code}`));
      }
    });
  });
}

test("registerProject appends an event, updates the projection, and exports projects by most recently opened", async () => {
  await withRegistry(async paths => {
    await initializeProjectRegistry(paths);
    await registerProject({
      id: "older-project",
      name: "Older_Project",
      path: "C:/projects/Older_Project",
      last_opened_at: "2026-07-29T10:00:00.000Z",
    }, paths);
    await registerProject({
      id: "newer-project",
      name: "Newer_Project",
      path: "C:/projects/Newer_Project",
      last_opened_at: "2026-07-29T11:00:00.000Z",
    }, paths);

    assert.deepEqual(await listRegisteredProjects(paths), [
      {
        id: "newer-project",
        name: "Newer_Project",
        path: "C:/projects/Newer_Project",
        last_opened_at: "2026-07-29T11:00:00.000Z",
      },
      {
        id: "older-project",
        name: "Older_Project",
        path: "C:/projects/Older_Project",
        last_opened_at: "2026-07-29T10:00:00.000Z",
      },
    ]);

    assert.deepEqual(JSON.parse(await readFile(paths.exportPath, "utf8")), await listRegisteredProjects(paths));

    const database = new DatabaseSync(paths.databasePath);
    try {
      assert.equal(Number((database.prepare("SELECT COUNT(*) AS count FROM events").get() as { count: number }).count), 2);
      assert.equal(Number((database.prepare("SELECT COUNT(*) AS count FROM projects").get() as { count: number }).count), 2);
    } finally {
      database.close();
    }
  });
});

test("openRegisteredProject records an open event and refreshes the projection timestamp", async () => {
  await withRegistry(async paths => {
    await initializeProjectRegistry(paths);
    await registerProject({
      id: "celia",
      name: "Celia",
      path: "C:/projects/Celia",
      last_opened_at: "2026-07-29T10:00:00.000Z",
    }, paths);

    const opened = await openRegisteredProject("celia", paths, "2026-07-29T12:00:00.000Z");

    assert.deepEqual(opened, {
      id: "celia",
      name: "Celia",
      path: "C:/projects/Celia",
      last_opened_at: "2026-07-29T12:00:00.000Z",
    });

    const database = new DatabaseSync(paths.databasePath);
    try {
      assert.equal(
        Number((database.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'project.opened'").get() as { count: number }).count),
        1,
      );
    } finally {
      database.close();
    }
  });
});

test("registering an existing path records an open event instead of a second registration", async () => {
  await withRegistry(async paths => {
    const project = {
      id: "celia",
      name: "Celia",
      path: "C:/projects/Celia",
      last_opened_at: "2026-07-29T10:00:00.000Z",
    };
    await registerProject(project, paths);
    await registerProject({ ...project, last_opened_at: "2026-07-29T11:00:00.000Z" }, paths);

    const database = new DatabaseSync(paths.databasePath);
    try {
      const eventTypes = (database.prepare("SELECT type FROM events ORDER BY id").all() as Array<{ type: string }>)
        .map((event) => ({ type: event.type }));
      assert.deepEqual(eventTypes, [
        { type: "project.registered" },
        { type: "project.opened" },
      ]);
    } finally {
      database.close();
    }
  });
});

test("assigns sequential slug suffixes to distinct paths with the same folder name", async () => {
  await withRegistry(async paths => {
    const first = await registerProject({
      id: "alpha",
      name: "Alpha",
      path: "C:/work/one/Alpha",
      last_opened_at: "2026-07-29T10:00:00.000Z",
    }, paths);
    const second = await registerProject({
      id: "alpha",
      name: "Alpha",
      path: "C:/work/two/Alpha",
      last_opened_at: "2026-07-29T11:00:00.000Z",
    }, paths);

    assert.equal(first.id, "alpha");
    assert.equal(second.id, "alpha-2");
    assert.deepEqual((await listRegisteredProjects(paths)).map((project) => project.id).sort(), ["alpha", "alpha-2"]);

    const database = new DatabaseSync(paths.databasePath);
    try {
      const event = database.prepare("SELECT payload FROM events ORDER BY id DESC LIMIT 1").get() as { payload: string };
      assert.equal(JSON.parse(event.payload).id, "alpha-2");
    } finally {
      database.close();
    }
  });
});

test("registry event triggers reject updates and deletes", async () => {
  await withRegistry(async paths => {
    await initializeProjectRegistry(paths);
    await registerProject({
      id: "celia",
      name: "Celia",
      path: "C:/projects/Celia",
      last_opened_at: "2026-07-29T10:00:00.000Z",
    }, paths);

    const database = new DatabaseSync(paths.databasePath);
    try {
      assert.throws(() => database.exec("UPDATE events SET actor = 'tampered' WHERE id = 1"), /not allowed/i);
      assert.throws(() => database.exec("DELETE FROM events WHERE id = 1"), /not allowed/i);
    } finally {
      database.close();
    }
  });
});

test("a failed projection write rolls back its companion registry event", async () => {
  await withRegistry(async paths => {
    await initializeProjectRegistry(paths);
    await registerProject({
      id: "celia",
      name: "Celia",
      path: "C:/projects/Celia",
      last_opened_at: "2026-07-29T10:00:00.000Z",
    }, paths);

    const database = new DatabaseSync(paths.databasePath);
    try {
      database.exec(`
        CREATE TRIGGER reject_project_projection_insert
        BEFORE INSERT ON projects
        WHEN NEW.path = 'C:/projects/Different-Celia'
        BEGIN
          SELECT RAISE(ROLLBACK, 'projection write rejected');
        END;
      `);
    } finally {
      database.close();
    }

    await assert.rejects(() => registerProject({
      id: "celia",
      name: "Different Celia",
      path: "C:/projects/Different-Celia",
      last_opened_at: "2026-07-29T11:00:00.000Z",
    }, paths));

    const verificationDatabase = new DatabaseSync(paths.databasePath);
    try {
      assert.equal(Number((verificationDatabase.prepare("SELECT COUNT(*) AS count FROM events").get() as { count: number }).count), 1);
      assert.equal(Number((verificationDatabase.prepare("SELECT COUNT(*) AS count FROM projects").get() as { count: number }).count), 1);
    } finally {
      verificationDatabase.close();
    }
  });
});

test("registry initialization enables WAL mode", async () => {
  await withRegistry(async paths => {
    await initializeProjectRegistry(paths);

    const database = new DatabaseSync(paths.databasePath);
    try {
      assert.equal(
        String((database.prepare("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode).toLowerCase(),
        "wal",
      );
    } finally {
      database.close();
    }
  });
});

test("concurrent registry processes retain both registrations and export both projects", async () => {
  await withRegistry(async paths => {
    await initializeProjectRegistry(paths);

    await Promise.all([
      runRegistryWriter(paths, {
        id: "first",
        name: "First",
        path: "C:/projects/First",
        last_opened_at: "2026-07-29T10:00:00.000Z",
      }),
      runRegistryWriter(paths, {
        id: "second",
        name: "Second",
        path: "C:/projects/Second",
        last_opened_at: "2026-07-29T10:01:00.000Z",
      }),
    ]);

    assert.deepEqual((await listRegisteredProjects(paths)).map(project => project.id), ["second", "first"]);
    assert.deepEqual((JSON.parse(await readFile(paths.exportPath, "utf8")) as ProjectRegistryEntry[]).map(project => project.id), ["second", "first"]);
  });
});

test("prepareProject scaffolds only a clean folder with the required config and local database", async () => {
  const directory = await mkdtemp(join(tmpdir(), "minna-project-scaffold-"));

  try {
    const result = await prepareProject(directory);

    assert.equal(result.initialized, true);
    const configPath = join(directory, ".minna", "config.yaml");
    assert.match(await readFile(configPath, "utf8"), /^version: 1\r?\ncreated_at: .+\r?\ndescription: null\r?\n$/);
    await access(join(directory, ".minna", "minna.db"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("prepareProject rejects an existing .minna directory without config and leaves it untouched", async () => {
  const directory = await mkdtemp(join(tmpdir(), "minna-project-invalid-"));
  const minnaDirectory = join(directory, ".minna");

  try {
    await mkdir(minnaDirectory);

    await assert.rejects(() => prepareProject(directory), /missing config\.yaml/i);
    await assert.rejects(() => access(join(minnaDirectory, "config.yaml")));
    assert.equal((await stat(minnaDirectory)).isDirectory(), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("prepareProject rejects invalid configuration dates without overwriting the file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "minna-project-invalid-date-"));
  const minnaDirectory = join(directory, ".minna");
  const configPath = join(minnaDirectory, "config.yaml");
  const invalidConfig = "version: 1\ncreated_at: not-a-date\ndescription: null\n";

  try {
    await mkdir(minnaDirectory);
    await writeFile(configPath, invalidConfig, "utf8");

    await assert.rejects(() => prepareProject(directory), /created_at.*ISO 8601/i);
    assert.equal(await readFile(configPath, "utf8"), invalidConfig);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("prepareProject initializes a missing local database for an otherwise valid project", async () => {
  const directory = await mkdtemp(join(tmpdir(), "minna-project-lazy-db-"));
  const minnaDirectory = join(directory, ".minna");

  try {
    await mkdir(minnaDirectory);
    await writeFile(
      join(minnaDirectory, "config.yaml"),
      "version: 1\ncreated_at: 2026-07-29T10:00:00.000Z\ndescription: null\n",
      "utf8",
    );

    const result = await prepareProject(directory);

    assert.equal(result.initialized, false);
    await access(join(minnaDirectory, "minna.db"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
