"use client";

import { useRef, useState } from "react";

import type { WorkItem } from "../core/types";
import { useModalFocus } from "./useModalFocus";

export interface FeatureDraft {
  title: string;
  description: string;
  detailsText: string;
  attachedFileName: string;
  attachedFileContent: string;
}

interface AddUpdateFeatureModalProps {
  mode: "create" | "update";
  projectName: string;
  nextId: string;
  feature?: WorkItem;
  onSave: (draft: FeatureDraft) => void;
  onCancel: (dirty: boolean) => void;
  onDrop: () => void;
}

export function AddUpdateFeatureModal({ mode, projectName, nextId, feature, onSave, onCancel, onDrop }: AddUpdateFeatureModalProps) {
  const initial: FeatureDraft = {
    title: feature?.title ?? "",
    description: feature?.description ?? "",
    detailsText: "",
    attachedFileName: "",
    attachedFileContent: "",
  };
  const [draft, setDraft] = useState(initial);
  const [tab, setTab] = useState<"text" | "file">("text");
  const dialogRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  useModalFocus(dialogRef, titleRef);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const id = feature?.id ?? nextId;

  const update = (key: keyof FeatureDraft, value: string) => setDraft(current => ({ ...current, [key]: value }));

  const attachMarkdownFile = async (file: File | undefined) => {
    if (!file) {
      setDraft(current => ({ ...current, attachedFileName: "", attachedFileContent: "" }));
      return;
    }
    const content = await file.text();
    setDraft(current => ({ ...current, attachedFileName: file.name, attachedFileContent: content }));
  };

  return (
    <div className="feature-modal-backdrop">
      <section aria-label={mode === "create" ? "Add Feature" : "Update Feature"} aria-modal="true" className="feature-modal" ref={dialogRef} role="dialog">
        <header>
          <h2>{mode === "create" ? "Add Feature" : "Update Feature"}</h2>
          <p>{projectName}</p>
        </header>
        <label className="feature-modal-field">
          <span>Feature number</span>
          <output>{id}</output>
        </label>
        <label className="feature-modal-field">
          <span>Feature title</span>
          {mode === "create" && <small>Limit to 5 words or less. Choose carefully as it can&apos;t be updated later.</small>}
          <input aria-label="Feature title" disabled={mode === "update"} maxLength={50} onChange={event => update("title", event.target.value)} placeholder="e.g. Refund flow redesign" ref={titleRef} value={draft.title} />
          <em>{draft.title.length}/50</em>
        </label>
        <label className="feature-modal-field">
          <span>Feature description</span>
          <small>Brief description of this feature.</small>
          <input aria-label="Feature description" maxLength={100} onChange={event => update("description", event.target.value)} placeholder="e.g. Lets users retry failed payments automatically" value={draft.description} />
          <em>{draft.description.length}/100</em>
        </label>
        <div className="feature-modal-field">
          <span>Feature details</span>
          <div aria-label="Feature detail mode" className="feature-modal-tabs" role="tablist">
            <button aria-selected={tab === "text"} onClick={() => setTab("text")} role="tab" type="button">Type here</button>
            <button aria-selected={tab === "file"} onClick={() => setTab("file")} role="tab" type="button">Attach MD file</button>
          </div>
          {tab === "text" ? (
            <>
              <textarea aria-label="Feature details" maxLength={2500} onChange={event => update("detailsText", event.target.value)} placeholder="Describe what this feature should do..." value={draft.detailsText} />
              <em>{draft.detailsText.length}/2500</em>
            </>
          ) : (
            <label className="feature-file-picker">
              <span>Choose File</span>
              <input accept=".md,text/markdown" aria-label="Attach markdown file" onChange={event => void attachMarkdownFile(event.target.files?.[0])} type="file" />
              <output>{draft.attachedFileName || "No file selected"}</output>
            </label>
          )}
        </div>
        <footer className="feature-modal-actions">
          <span>{mode === "update" && <button className="feature-button--danger" onClick={onDrop} type="button">Drop Feature</button>}</span>
          <button onClick={() => onCancel(dirty)} type="button">Discard</button>
          <button disabled={!dirty} onClick={() => onSave(draft)} type="button">Save</button>
        </footer>
      </section>
    </div>
  );
}
