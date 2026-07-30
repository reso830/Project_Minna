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

---

## 5. Editing Project Display Name

1. In the left sidebar list of projects, hover over the project you wish to modify.
2. Click the **vertical/horizontal ellipsis (⋯)** button that appears.
3. Select **Edit Project** from the actions menu popover.
4. Modify the project name in the text input (e.g. `My Awesome Project`).
5. Click **Save**.
6. **Result**:
   - The registry writes a `project.renamed` event and updates the projects projection table in `~/.minna/projects.db`.
   - The UI sidebar display name updates immediately. The local project `.minna/config.yaml` is not edited (rename is registry-only).

---

## 6. Relocating Project Directory

1. Open the **Edit Project** modal for the desired project.
2. Click **Select project directory** (next to the folder path field).
3. Choose a new directory path in the native OS folder picker.
4. **Relocation Validation**:
   - **Case A (Valid Target)**: The chosen target path contains a valid `.minna/config.yaml`. Click **Save** to persist. Minna updates the registered path, writes a `project.relocated` event, and switches focus.
   - **Case B (Missing Config Target)**: The target path lacks `.minna/config.yaml`. An Error Modal appears detailing the validation rejection. Relocation is aborted. No scaffolding is executed.
   - **Case C (Duplicate Target)**: The target path is already registered under another project. An Error Modal appears: `"This directory is already registered as project '{existing_project_name}'."` Relocation is aborted.

---

## 7. Removing Project from Registry

1. Open the actions menu popover for the project, or click the red **Remove Project** button on the bottom-left of the Edit Project Modal.
2. A Remove confirmation modal will appear: `"Remove '{project name}'? This removes the project from Minna. Your project files on disk won't be affected."`
3. Click the red **Remove Project** confirmation button.
4. **Result**:
   - The registry deletes the row from the `projects` projection table and records a `project.removed` event.
   - The project is removed from the sidebar. All folder contents on disk are completely untouched.
   - If you removed the currently active project, the active project context is reset to `null` and the UI renders the empty screen state.

---

## 8. Ongoing Project Health Checks & Lazy open DB repairs

To test the ongoing health checks and database self-healing on load:
1. **Unavailable/Muted States**: Delete `.minna/config.yaml` from a registered project directory (or mock a missing path).
   - Reload the browser.
   - The project row in the sidebar displays as muted and grayed out, and clicking it to open is blocked.
2. **Missing Local DB Self-Healing**: Delete `.minna/minna.db` from a healthy project directory (while keeping its `.minna/config.yaml` intact).
   - Reload the browser.
   - The project row displays as healthy/available in the sidebar (since reads do not mutate disk files).
   - Click the project row. Minna opens the project and lazily calls `prepareProject()`, creating and initializing `.minna/minna.db` tables automatically.
