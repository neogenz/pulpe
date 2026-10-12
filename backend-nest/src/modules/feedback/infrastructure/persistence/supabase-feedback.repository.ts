import { Injectable } from '@nestjs/common';
import type { FeedbackCreate } from 'pulpe-shared';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { FeedbackRepositoryPort } from '../../domain/ports/feedback-repository.port';

@Injectable()
export class SupabaseFeedbackRepository implements FeedbackRepositoryPort {
  constructor(
    private readonly authenticatedProvider: AuthenticatedSupabaseProvider,
  ) {}

  async insert(feedback: FeedbackCreate): Promise<void> {
    const userId = this.authenticatedProvider.user.id;
    const { error } = await this.authenticatedProvider.client
      .from('user_feedback')
      .insert({
        user_id: userId,
        overall_rating: feedback.overallRating,
        onboarding: feedback.onboarding,
        budget_clarity: feedback.budgetClarity,
        current_month: feedback.currentMonth,
        future_planning: feedback.futurePlanning,
        home_clarity: feedback.homeClarity,
        comment: feedback.comment,
        app_version: feedback.appVersion,
        platform: feedback.platform,
        ios_version: feedback.iosVersion,
      });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.FEEDBACK_SUBMIT_FAILED,
        undefined,
        { userId, operation: 'feedback.submit' },
        { cause: error },
      );
    }
  }

  async hasSubmitted(): Promise<boolean> {
    const userId = this.authenticatedProvider.user.id;
    const { data, error } = await this.authenticatedProvider.client
      .from('user_feedback')
      .select('user_id')
      .eq('user_id', userId)
      .limit(1);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.FEEDBACK_STATUS_FAILED,
        undefined,
        { userId, operation: 'feedback.status' },
        { cause: error },
      );
    }
    return data.length > 0;
  }
}
