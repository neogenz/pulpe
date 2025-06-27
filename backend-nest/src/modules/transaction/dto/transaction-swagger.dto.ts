import { createZodDto } from 'nestjs-zod';
import {
  transactionCreateSchema,
  transactionUpdateSchema,
  transactionResponseSchema,
  transactionListResponseSchema,
  transactionDeleteResponseSchema,
} from '@pulpe/shared';

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
