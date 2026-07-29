"use client";

import { useRef, useState } from "react";

import type { ProjectRegistryEntry } from "../core/types";
import { useModalFocus } from "./useModalFocus";

interface EditProjectModalProps {
  active?: boolean;
  onCancel: (dirty: boolean) => void;
  onRemove: () => void;
  onSave: (name: string, path: string) => void;
  onSelectPath: () => Promise<string | null>;
  project: ProjectRegistryEntry;
}

export function EditProjectModal({ active = true, onCancel, onRemove, onSave, onSelectPath, project }: EditProjectModalProps) {
  const [name, setName] = useState(project.name);
  const [path, setPath] = useState(project.path);
  const dialogRef = useRef<HTMLElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const dirty = name !== project.name || path !== project.path;
  useModalFocus(dialogRef, nameInputRef, active);

  return (
    <div className="project-modal-backdrop" hidden={!active}>
      <section aria-label={`Edit ${project.name}`} aria-modal="true" className="project-modal project-modal--edit" ref={dialogRef} role="dialog">
        <h2>Edit Project</h2>
        <label className="project-modal-field">
          <span>Rename project</span>
          <input aria-label="Project name" onChange={(event) => setName(event.target.value)} ref={nameInputRef} value={name} />
        </label>
        <div className="project-modal-field">
          <span>Relocate project</span>
          <div className="project-modal-path">
            <output aria-label="Project path">{path}</output>
            <button onClick={() => void onSelectPath().then((selectedPath) => selectedPath && setPath(selectedPath))} type="button">Select project directory</button>
          </div>
        </div>
        <div className="project-modal-actions">
          <button className="project-modal-remove" onClick={onRemove} type="button">Remove Project</button>
          <span />
          <button onClick={() => onCancel(dirty)} type="button">Cancel</button>
          <button className="project-modal-save" disabled={!dirty} onClick={() => onSave(name, path)} type="button">Save</button>
        </div>
      </section>
    </div>
  );
}
