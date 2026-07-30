import { execFile } from "node:child_process";
import { promisify } from "node:util";

type PickerExecutor = (command: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;

export class DirectoryPickerCancelledError extends Error {}

const executeFile: PickerExecutor = async (command, args) => {
  const execute = promisify(execFile);
  const { stdout, stderr } = await execute(command, args, { windowsHide: true });
  return { stdout: String(stdout), stderr: String(stderr) };
};

export async function pickDirectory(
  platform = process.platform,
  execute: PickerExecutor = executeFile,
): Promise<string> {
  let command: string;
  let args: string[];

  if (platform === "darwin") {
    command = "osascript";
    args = ["-e", 'POSIX path of (choose folder with prompt "Select a Minna project folder")'];
  } else if (platform === "win32") {
    command = "powershell.exe";
    args = [
      "-NoProfile",
      "-STA",
      "-Command",
      "Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = 'Select a Minna project folder'; if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($dialog.SelectedPath) }",
    ];
  } else {
    command = "zenity";
    args = ["--file-selection", "--directory", "--title=Select a Minna project folder"];
  }

  let stdout: string;
  try {
    ({ stdout } = await execute(command, args));
  } catch (error) {
    if (platform !== "win32" && (error as { code?: unknown }).code === 1) {
      throw new DirectoryPickerCancelledError("Directory picker was cancelled by the user.");
    }
    throw error;
  }
  const directory = stdout.trim();
  if (!directory) {
    throw new DirectoryPickerCancelledError("Directory picker was cancelled by the user.");
  }
  return directory;
}
