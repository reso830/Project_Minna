# Quickstart: Project Creation

This guide provides instructions on how to use and verify the Project Creation feature after its implementation.

## Starting the Application

Launch the Next.js development server:
```bash
npm run dev
```

Navigate to `http://localhost:3000` in your web browser.

---

## 1. Adding a Project via the UI

1. Open the sidebar and click the **`+` (Add Project)** button next to the **Projects** heading.
2. The operating system's native folder picker will open:
   - On Windows: A Win32 Folder Browser Dialog will appear.
   - On macOS: An AppleScript Folder Chooser will slide down.
3. Select any directory (e.g. `/path/to/Project_Monica`).
4. **Result**:
   - If the directory does not have a `.minna` folder, Minna will automatically create `.minna/` and initialize `.minna/config.yaml` inside it.
   - The directory is added to the global project database registry `~/.minna/projects.db`.
   - The directory name casing is preserved as `Project_Monica` under the `name` field, and slugified to `project-monica` under the `id` field.
   - The sidebar updates immediately and highlights the new project at the top of the Projects list.

---

## 2. Opening an Existing Project

1. Click the **`+` (Add Project)** button.
2. Select a folder that already contains a valid `.minna/config.yaml`.
3. **Result**:
   - Minna validates the configuration, updates `last_opened_at` in the global database registry, and loads the project.
   - The existing configuration file remains untouched (no files are overwritten).

---

## 3. Simulating Rejection / Validation Failures

To verify validation error states:
1. Create a directory called `corrupt-project`.
2. Create a folder named `.minna` inside it.
3. Leave the `.minna` folder empty (do not create `config.yaml`) OR write malformed text to `.minna/config.yaml`.
4. Click **`+` (Add Project)** in Minna and select the `corrupt-project` folder.
5. **Result**:
   - A dedicated error modal will overlay the workspace detailing the validation failure (e.g. `Missing config.yaml` or `YAML Parse Error`).
   - Because the `.minna/` directory already existed, Minna rejects the import immediately instead of scaffolding a default config.
   - The registry database `~/.minna/projects.db` is not modified, and the project is not added to the sidebar.

---

## 4. Syncing via the CLI

When working with the CLI, any command run within a project directory automatically registers the project in `~/.minna/projects.db`.

1. Open your terminal and navigate to the project folder:
   ```bash
   cd /path/to/Project_Monica
   ```
2. Run any CLI command:
   ```bash
   npm run cli status
   ```
3. **Result**:
   - The CLI will initialize the registry sync using database write locks.
   - Check the registry events in `~/.minna/projects.db` or examine the read-only projection file `~/.minna/projects.json` to confirm that the project path is registered with its `last_opened_at` timestamp updated to the execution time.
