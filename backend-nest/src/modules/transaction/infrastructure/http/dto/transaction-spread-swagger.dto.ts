import { createZodDto } from 'nestjs-zod';
import {
  budgetLineSpreadResponseSchema,
  transactionSpreadFromTxnCreateSchema,
} from 'pulpe-shared';

export class TransactionSpreadFromTxnCreateDto extends createZodDto(
  transactionSpreadFromTxnCreateSchema,
) {}

/**
 * The spread-from-txn response is the SAME envelope as the budget-line spread:
 * a réel is redistributed into N budget_line tranches sharing a spreadGroupId.
 */
export class TransactionSpreadResponseDto extends createZodDto(
  budgetLineSpreadResponseSchema,
) {}
