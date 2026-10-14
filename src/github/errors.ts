export type GitHubConnectorErrorCode =
  | 'invalid_input'
  | 'invalid_webhook_signature'
  | 'webhook_delivery_conflict'
  | 'installation_not_active'
  | 'repository_not_selected'
  | 'repository_identity_mismatch'
  | 'setup_state_invalid'
  | 'installation_suspended'
  | 'installation_account_mismatch'
  | 'provider_http_failure'
  | 'provider_payload_invalid'
  | 'tag_inventory_bound_exceeded';

export class GitHubConnectorError extends Error {
  readonly code: GitHubConnectorErrorCode;

  constructor(code: GitHubConnectorErrorCode, message: string) {
    super(message);
    this.name = 'GitHubConnectorError';
    this.code = code;
  }
}

export function githubConnectorError(
  code: GitHubConnectorErrorCode,
  message: string
): GitHubConnectorError {
  return new GitHubConnectorError(code, message);
}

export function isGitHubConnectorError(error: unknown): error is GitHubConnectorError {
  return error instanceof GitHubConnectorError;
}
