import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { ValidateTokenQuery } from '../queries/validate-token.query';
import {
  type AuthRepository,
  AUTH_REPOSITORY_TOKEN,
} from '../../domain/repositories/auth.repository';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';

@Injectable()
@QueryHandler(ValidateTokenQuery)
export class ValidateTokenHandler implements IQueryHandler<ValidateTokenQuery> {
  constructor(
    @Inject(AUTH_REPOSITORY_TOKEN)
    private readonly authRepository: AuthRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ValidateTokenHandler.name);
  }

  async execute(query: ValidateTokenQuery): Promise<Result<boolean>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'validate-token.start',
    });

    try {
      // Validate the token
      const result = await this.authRepository.validateToken(query.accessToken);

      if (result.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'validate-token.failed',
          error: result.error.message,
          duration,
        });
        return result;
      }

      const isValid = result.getValue();

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'validate-token.success',
        isValid,
        duration,
      });

      return Result.ok(isValid);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'validate-token.error',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to validate token',
          'VALIDATE_TOKEN_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
