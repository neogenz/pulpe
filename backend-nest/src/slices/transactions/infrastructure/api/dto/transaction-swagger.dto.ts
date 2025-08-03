import { createZodDto } from '@anatine/zod-nestjs';
import { extendApi } from '@anatine/zod-openapi';
import {
  transactionSchema,
  transactionCreateSchema,
  transactionUpdateSchema,
  transactionListResponseSchema,
  transactionResponseSchema,
  transactionDeleteResponseSchema,
} from '@pulpe/shared';

// Create Swagger DTOs
export class TransactionDto extends createZodDto(
  extendApi(transactionSchema),
) {}

export class TransactionCreateDto extends createZodDto(
  extendApi(transactionCreateSchema),
) {}

export class TransactionUpdateDto extends createZodDto(
  extendApi(transactionUpdateSchema),
) {}

export class TransactionListResponseDto extends createZodDto(
  extendApi(transactionListResponseSchema),
) {}

export class TransactionResponseDto extends createZodDto(
  extendApi(transactionResponseSchema),
) {}

export class TransactionDeleteResponseDto extends createZodDto(
  extendApi(transactionDeleteResponseSchema),
) {}
