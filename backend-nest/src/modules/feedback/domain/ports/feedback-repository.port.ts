import type { FeedbackCreate } from 'pulpe-shared';

export const FEEDBACK_REPOSITORY = Symbol('FEEDBACK_REPOSITORY');

export interface FeedbackRepositoryPort {
  insert(feedback: FeedbackCreate): Promise<void>;
}
