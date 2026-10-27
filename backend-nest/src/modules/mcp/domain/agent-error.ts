import type { ErrorDefinition } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';

/** A refusal already worded for the agent: relayed as is, never reworded. */
export class AgentError extends BusinessException {}

/**
 * A refusal raised by an MCP tool itself: same code and status as the
 * definition, in French words the agent can act on.
 */
export const agentError = (
  definition: ErrorDefinition,
  message: string,
  details?: Record<string, unknown>,
  loggingContext?: Record<string, unknown>,
): AgentError =>
  new AgentError(
    { ...definition, message: () => message },
    details,
    loggingContext,
  );
