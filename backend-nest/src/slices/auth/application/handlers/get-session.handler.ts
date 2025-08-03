import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { Result } from '@shared/domain/enhanced-result';
import { GetSessionQuery } from '../queries/get-session.query';
import {
  type AuthRepository,
  AUTH_REPOSITORY_TOKEN,
} from '../../domain/repositories/auth.repository';
import { AuthSession } from '../../domain/entities/auth-session.entity';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';

@Injectable()
@QueryHandler(GetSessionQuery)
export class GetSessionHandler implements IQueryHandler<GetSessionQuery> {
  constructor(
    @Inject(AUTH_REPOSITORY_TOKEN)
    private readonly authRepository: AuthRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GetSessionHandler.name);
  }

  async execute(query: GetSessionQuery): Promise<Result<AuthSession | null>> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'get-session.start',
    });

    try {
      // Get the session
      const result = await this.authRepository.getSession(query.accessToken);

      if (result.isFailure) {
        const duration = performance.now() - startTime;
        this.logger.warn({
          operation: 'get-session.failed',
          error: result.error.message,
          duration,
        });
        return result;
      }

      const session = result.getValue();

      const duration = performance.now() - startTime;
      this.logger.info({
        operation: 'get-session.success',
        userId: session?.userId,
        duration,
      });

      return Result.ok(session);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'get-session.error',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to get session',
          'GET_SESSION_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }
}
