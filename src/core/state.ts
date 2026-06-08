import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FeatureState, ManualTestResult, OperatorDecision, PhaseId } from "./types.js";

const STATE_DIR = "state";
const STATE_FILE = join(STATE_DIR, "features.json");

interface StateFile {
  features: FeatureState[];
}

async function readState(): Promise<StateFile> {
  try {
    const text = await readFile(STATE_FILE, "utf8");
    return JSON.parse(text) as StateFile;
  } catch {
    return { features: [] };
  }
}

async function writeState(state: StateFile): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true });
  // Single-operator scaffold: add file locking before concurrent CLI/MCP writes.
  await writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function listFeatures(): Promise<FeatureState[]> {
  return (await readState()).features;
}

export async function startFeature(project: string, title: string): Promise<FeatureState> {
  const state = await readState();
  const now = new Date().toISOString();
  const feature: FeatureState = {
    id: slugify(`${project}-${title}-${Date.now()}`),
    project,
    title,
    phase: "specify",
    createdAt: now,
    updatedAt: now,
    decisions: [],
    manualTests: []
  };

  state.features.push(feature);
  await writeState(state);
  return feature;
}

export async function updateFeaturePhase(id: string, phase: PhaseId): Promise<FeatureState> {
  return updateFeature(id, feature => {
    feature.phase = phase;
  });
}

export async function recordDecision(id: string, question: string, answer: string): Promise<FeatureState> {
  return updateFeature(id, feature => {
    const decision: OperatorDecision = {
      id: slugify(`decision-${Date.now()}`),
      question,
      answer,
      recordedAt: new Date().toISOString()
    };
    feature.decisions.push(decision);
  });
}

export async function recordManualTest(id: string, passed: boolean, notes: string): Promise<FeatureState> {
  return updateFeature(id, feature => {
    const result: ManualTestResult = {
      id: slugify(`manual-test-${Date.now()}`),
      passed,
      notes,
      recordedAt: new Date().toISOString()
    };
    feature.manualTests.push(result);
  });
}

async function updateFeature(id: string, mutate: (feature: FeatureState) => void): Promise<FeatureState> {
  const state = await readState();
  const feature = state.features.find(candidate => candidate.id === id);

  if (!feature) {
    throw new Error(`Feature not found: ${id}`);
  }

  mutate(feature);
  feature.updatedAt = new Date().toISOString();
  await writeState(state);
  return feature;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
