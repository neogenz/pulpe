import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  transactionCreateSchema,
  transactionUpdateSchema,
  transactionResponseSchema,
  transactionListResponseSchema,
  transactionDeleteResponseSchema,
  transactionSearchResponseSchema,
} from 'pulpe-shared';

// DTOs pour la documentation Swagger basés sur les schémas Zod partagés
export class TransactionCreateDto extends createZodDto(
  transactionCreateSchema,
) {}
export class TransactionUpdateDto extends createZodDto(
  transactionUpdateSchema,
) {}
export class TransactionResponseDto extends createZodDto(
  transactionResponseSchema,
) {}
export class TransactionListResponseDto extends createZodDto(
  transactionListResponseSchema,
) {}
export class TransactionDeleteResponseDto extends createZodDto(
  transactionDeleteResponseSchema,
) {}

// Search DTOs
const searchQuerySchema = z.object({
  q: z.string().min(2).max(100),
});
export class TransactionSearchQueryDto extends createZodDto(
  searchQuerySchema,
) {}
export class TransactionSearchResponseDto extends createZodDto(
  transactionSearchResponseSchema,
) {}
