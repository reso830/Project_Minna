export interface CodexPhaseRequest {
  featureId: string;
  taskPath?: string;
}

export async function requestCodexImplementation(request: CodexPhaseRequest): Promise<string> {
  return `Codex adapter pending for ${request.featureId}`;
}
