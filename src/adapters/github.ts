export interface GitHubLinkRequest {
  project: string;
  featureId: string;
  title: string;
}

export async function createOrLinkIssue(request: GitHubLinkRequest): Promise<string> {
  return `GitHub issue adapter pending for ${request.project}:${request.featureId}:${request.title}`;
}
