import { createZodDto } from 'nestjs-zod';
import {
  transactionCreateSchema,
  transactionUpdateSchema,
  transactionResponseSchema,
  transactionListResponseSchema,
  transactionDeleteResponseSchema,
  transactionPostponeResponseSchema,
  transactionSearchQuerySchema,
  transactionSearchResponseSchema,
} from 'pulpe-shared';

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
export class TransactionPostponeResponseDto extends createZodDto(
  transactionPostponeResponseSchema,
) {}

export class TransactionSearchQueryDto extends createZodDto(
  transactionSearchQuerySchema,
) {}
export class TransactionSearchResponseDto extends createZodDto(
  transactionSearchResponseSchema,
) {}
