import { createZodDto } from 'nestjs-zod';
import {
  budgetLineSpreadResponseSchema,
  spreadOccurrencesResponseSchema,
  transactionListResponseSchema,
  transactionSpreadFromTxnCreateSchema,
} from 'pulpe-shared';

export class AllocationTransactionListResponseDto extends createZodDto(
  transactionListResponseSchema,
) {}

export class AllocationSpreadOccurrencesResponseDto extends createZodDto(
  spreadOccurrencesResponseSchema,
) {}

export class AllocationTransactionSpreadFromTxnCreateDto extends createZodDto(
  transactionSpreadFromTxnCreateSchema,
) {}

export class AllocationTransactionSpreadResponseDto extends createZodDto(
  budgetLineSpreadResponseSchema,
) {}
