import { createZodDto } from 'nestjs-zod';
import {
  feedbackCreateSchema,
  feedbackStatusResponseSchema,
} from 'pulpe-shared';

export class FeedbackCreateDto extends createZodDto(feedbackCreateSchema) {}

export class FeedbackStatusResponseDto extends createZodDto(
  feedbackStatusResponseSchema,
) {}
