import { Inject, Injectable } from '@nestjs/common';
import type { FeedbackStatusResponse } from 'pulpe-shared';
import {
  FEEDBACK_REPOSITORY,
  type FeedbackRepositoryPort,
} from '../domain/ports/feedback-repository.port';

@Injectable()
export class GetFeedbackStatusUseCase {
  constructor(
    @Inject(FEEDBACK_REPOSITORY)
    private readonly repository: FeedbackRepositoryPort,
  ) {}

  async execute(): Promise<FeedbackStatusResponse> {
    return { hasSubmitted: await this.repository.hasSubmitted() };
  }
}
