import { createZodDto } from 'nestjs-zod';
import { feedbackCreateSchema } from 'pulpe-shared';

export class FeedbackCreateDto extends createZodDto(feedbackCreateSchema) {}
