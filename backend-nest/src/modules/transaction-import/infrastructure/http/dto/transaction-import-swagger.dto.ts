import { createZodDto } from 'nestjs-zod';
import {
  transactionImportPreviewResponseSchema,
  transactionImportRequestSchema,
  transactionImportResponseSchema,
} from 'pulpe-shared';

export class TransactionImportRequestDto extends createZodDto(
  transactionImportRequestSchema,
) {}
export class TransactionImportPreviewResponseDto extends createZodDto(
  transactionImportPreviewResponseSchema,
) {}
export class TransactionImportResponseDto extends createZodDto(
  transactionImportResponseSchema,
) {}
