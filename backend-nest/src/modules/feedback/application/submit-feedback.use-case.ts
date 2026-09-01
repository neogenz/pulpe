import { Inject, Injectable } from '@nestjs/common';
import type { FeedbackCreate } from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import {
  FEEDBACK_REPOSITORY,
  type FeedbackRepositoryPort,
} from '../domain/ports/feedback-repository.port';

@Injectable()
export class SubmitFeedbackUseCase {
  constructor(
    @Inject(FEEDBACK_REPOSITORY)
    private readonly repository: FeedbackRepositoryPort,
    @InjectInfoLogger(SubmitFeedbackUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    feedback: FeedbackCreate,
    user: AuthenticatedUser,
  ): Promise<void> {
    await this.repository.insert(feedback);
    this.logger.info(
      { userId: user.id, operation: 'feedback.submit' },
      'Feedback submitted',
    );
  }
}
