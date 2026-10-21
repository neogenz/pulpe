import {
  ERROR_DEFINITIONS,
  type ErrorDefinition,
} from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';

/**
 * Same code and status as the tag module's error, in the words an agent can
 * act on. `mcp.controller` relays the message of any error below 500, so it
 * reaches the model as is; the tag module keeps its English definitions.
 */
const forAgent = (
  definition: ErrorDefinition,
  message: string,
): ErrorDefinition => ({ ...definition, message: () => message });

export function toTagToolError(error: unknown, name?: string): unknown {
  if (!(error instanceof BusinessException)) return error;
  const reword = (definition: ErrorDefinition, message: string) =>
    new BusinessException(
      forAgent(definition, message),
      error.details,
      error.loggingContext,
      { cause: error },
    );
  if (error.code === ERROR_DEFINITIONS.TAG_NOT_FOUND.code) {
    return reword(
      ERROR_DEFINITIONS.TAG_NOT_FOUND,
      'Tag introuvable. Appelle list_tags pour les ids valides.',
    );
  }
  if (error.code === ERROR_DEFINITIONS.TAG_ALREADY_EXISTS.code) {
    return reword(
      ERROR_DEFINITIONS.TAG_ALREADY_EXISTS,
      `Un tag « ${name} » existe déjà (casse ignorée). Appelle list_tags pour reprendre son id.`,
    );
  }
  return error;
}

export function unknownTagIdsError(ids: string[]): BusinessException {
  return new BusinessException(
    forAgent(
      ERROR_DEFINITIONS.VALIDATION_FAILED,
      `Tags inconnus : ${ids.join(', ')}. Appelle list_tags ; rien n’a été modifié.`,
    ),
    { ids },
    { operation: 'mcp.tag_items' },
  );
}
