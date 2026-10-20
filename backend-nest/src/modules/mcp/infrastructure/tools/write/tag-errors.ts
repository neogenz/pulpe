import { ConflictException, NotFoundException } from '@nestjs/common';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';

/**
 * The tag module's business errors in the words an agent can act on.
 * `mcp.controller` relays the message of any error below 500, so these reach
 * the model as is; the tag module keeps its English error definitions.
 */
export function toTagToolError(error: unknown, name?: string): unknown {
  if (!(error instanceof BusinessException)) return error;
  if (error.code === ERROR_DEFINITIONS.TAG_NOT_FOUND.code) {
    return new NotFoundException(
      'Tag introuvable. Appelle list_tags pour les ids valides.',
    );
  }
  if (error.code === ERROR_DEFINITIONS.TAG_ALREADY_EXISTS.code) {
    return new ConflictException(
      `Un tag « ${name} » existe déjà (casse ignorée). Appelle list_tags pour reprendre son id.`,
    );
  }
  return error;
}
