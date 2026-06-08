export interface ClaudePhaseRequest {
  featureId: string;
  phase: string;
  contextPath?: string;
}

export async function requestClaudePhase(request: ClaudePhaseRequest): Promise<string> {
  return `Claude adapter pending for ${request.featureId}:${request.phase}`;
}
