import { createZodDto } from 'nestjs-zod';
import {
  transactionImportConfirmRequestSchema,
  transactionImportPreviewResponseSchema,
  transactionImportRequestSchema,
  transactionImportResponseSchema,
} from 'pulpe-shared';

export class TransactionImportRequestDto extends createZodDto(
  transactionImportRequestSchema,
) {}
export class TransactionImportConfirmRequestDto extends createZodDto(
  transactionImportConfirmRequestSchema,
) {}
export class TransactionImportPreviewResponseDto extends createZodDto(
  transactionImportPreviewResponseSchema,
) {}
export class TransactionImportResponseDto extends createZodDto(
  transactionImportResponseSchema,
) {}
