import { HttpException } from '@nestjs/common';
import { ErrorDefinition } from '@common/constants/error-definitions';

/**
 * Exception métier qui transporte un contexte d'erreur structuré.
 *
 * @example
 * throw new BusinessException(
 *   ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
 *   { id: budgetId }, // Details pour le message client
 *   { userId: user.id, entityId: budgetId, entityType: 'Budget' } // Contexte pour les logs
 * );
 */
export class BusinessException extends HttpException {
  public readonly code: string;
  public readonly details: Record<string, unknown> | undefined;
  public readonly loggingContext: Record<string, unknown>;
  public override readonly cause: Error | unknown;

  constructor(
    errorDefinition: ErrorDefinition,
    details?: Record<string, unknown>,
    loggingContext: Record<string, unknown> = {},
    options?: { cause?: Error | unknown },
  ) {
    // Génère le message final et l'envoie au parent
    const message = errorDefinition.message(details);

    // Utilise la propriété 'cause' standard ES2022 si disponible
    const httpExceptionOptions: { cause?: Error | unknown } = {};
    if (options?.cause) {
      httpExceptionOptions.cause = options.cause;
    }

    super(message, errorDefinition.httpStatus, httpExceptionOptions);

    // Stocke les informations structurées
    this.name = this.constructor.name;
    this.code = errorDefinition.code;
    this.details = details;
    this.loggingContext = loggingContext;
    this.cause = options?.cause;
  }

  /**
   * Récupère la chaîne causale complète des erreurs
   */
  getCauseChain(): (Error | unknown)[] {
    const chain: (Error | unknown)[] = [];
    const seen = new WeakSet<object>(); // Pour éviter les références circulaires
    let current: Error | unknown = this.cause;

    while (current) {
      // WeakSet ne peut contenir que des objets
      if (typeof current === 'object' && current !== null) {
        if (seen.has(current)) {
          break; // Référence circulaire détectée
        }
        seen.add(current);
      }

      chain.push(current);

      // Support pour Error.cause (ES2022) et les patterns courants
      if (current && typeof current === 'object') {
        const errorLike = current as Record<string, unknown>;
        current =
          errorLike.cause || errorLike.originalError || errorLike.parentError;
      } else {
        break;
      }
    }

    return chain;
  }

  /**
   * Récupère la cause racine (la plus profonde)
   */
  getRootCause(): Error | unknown {
    const chain = this.getCauseChain();
    return chain.length > 0 ? chain[chain.length - 1] : this.cause;
  }
}
