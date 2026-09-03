import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { SupabaseModule } from '@modules/supabase/supabase.module';
import { SubmitFeedbackUseCase } from './application/submit-feedback.use-case';
import { FEEDBACK_REPOSITORY } from './domain/ports/feedback-repository.port';
import { FeedbackController } from './infrastructure/http/feedback.controller';
import { SupabaseFeedbackRepository } from './infrastructure/persistence/supabase-feedback.repository';

@Module({
  imports: [SupabaseModule],
  controllers: [FeedbackController],
  providers: [
    SubmitFeedbackUseCase,
    {
      provide: FEEDBACK_REPOSITORY,
      useClass: SupabaseFeedbackRepository,
    },
    createInfoLoggerProvider(SubmitFeedbackUseCase.name),
  ],
})
export class FeedbackModule {}
