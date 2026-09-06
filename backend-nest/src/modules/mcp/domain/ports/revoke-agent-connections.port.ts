export const REVOKE_AGENT_CONNECTIONS_PORT = Symbol(
  'REVOKE_AGENT_CONNECTIONS_PORT',
);

/**
 * Cuts every agent connection of a user at once. Called when the vault key
 * changes (PIN change, recovery) and when the account is scheduled for
 * deletion: the wrapped copies of the old key would be dead weight.
 */
export interface RevokeAgentConnectionsPort {
  revokeAll(userId: string, accessToken: string): Promise<void>;
}
