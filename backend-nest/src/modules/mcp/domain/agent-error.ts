import type { ErrorDefinition } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';

/**
 * A refusal raised by an MCP tool itself: same code and status as the
 * definition, in French words the agent can act on. The MCP controller relays
 * the message of any error below 500 to the model as is.
 */
export const agentError = (
  definition: ErrorDefinition,
  message: string,
  details?: Record<string, unknown>,
  loggingContext?: Record<string, unknown>,
): BusinessException =>
  new BusinessException(
    { ...definition, message: () => message },
    details,
    loggingContext,
  );
