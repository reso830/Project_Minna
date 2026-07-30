# Research: Project Creation

This document details research and implementation strategies for OS-specific native folder selection and registry database write synchronization.

## 1. Native Folder Picking in Node.js

Since the Next.js frontend runs in a browser and does not have direct filesystem read/write access or standard OS folder dialog access with absolute paths, the server-side Next.js Node.js runtime must invoke the dialog and return the path.

To avoid introducing external binary npm packages, we can execute native commands via Node's `child_process.exec`.

### A. Windows (PowerShell)
On Windows, we can use a PowerShell script invoking `System.Windows.Forms.FolderBrowserDialog`. Since the dialog runs inside the PowerShell process, it presents a native Win32 window.

**Command**:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Select Minna Project Folder'; if ($f.ShowDialog() -eq 'OK') { $f.SelectedPath }"
```

**Testing on Windows Shell**:
- Runs in synchronous or asynchronous exec.
- Resolves the absolute path correctly (e.g. `D:\Alvin\_CodeProjects\Project_Minna`).
- Handles trailing carriage returns and prints empty line or nothing if cancelled.

### B. macOS (AppleScript)
On macOS, we use `osascript` to trigger a system dialog.

**Command**:
```bash
osascript -e 'POSIX path of (choose folder with prompt "Select Minna Project Folder")'
```

**Output**:
- Returns the absolute Unix path (e.g. `/Users/username/dev/project`).
- If cancelled, standard error is thrown: `User canceled. (-128)`, which the Node.js server catch block translates to a cancellation status.

### C. Linux (Zenity / KDialog / Python)
On Linux systems, we check for visual dialog utilities:
1. `zenity --file-selection --directory --title="Select Minna Project Folder"`
2. If `zenity` is not found, attempt `kdialog --getexistingdirectory`.
3. If neither is available, fallback to a CLI prompt or a Python/Tkinter script.

---

## 2. SQLite Database Registry and Concurrency

The project registry is implemented as a local SQLite database at `~/.minna/projects.db`. Using a database instead of a JSON flat-file addresses **Constitution Principle III (State is the source of truth)** and prevents lost updates from concurrent CLI/web operations.

### A. Transactional Locking
To prevent last-writer-wins races during concurrent write operations (e.g. a CLI command and Next.js server updating the registry at the exact same moment), the database operations must be wrapped in write locks:

```sql
BEGIN IMMEDIATE TRANSACTION;
```

In SQLite, `BEGIN IMMEDIATE` acquires a reserved lock on the database immediately. No other connection can start a write transaction or modify data until the current transaction commits or rolls back. Any concurrent write attempt receives a `SQLITE_BUSY` error, which is caught and retried automatically using a configurable busy timeout.

### B. Write-Ahead Logging (WAL) Mode
To enable concurrent reads from the Next.js server while writes are executing from the CLI, the registry database must be configured with:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
```

This prevents readers from blocking writers and vice-versa, ensuring low-latency operations and high reliability in a local developer environment.
