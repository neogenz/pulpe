import { createZodDto } from 'nestjs-zod';
import {
  currencyRateQuerySchema,
  currencyRateResponseSchema,
} from 'pulpe-shared';

export class CurrencyRateQueryDto extends createZodDto(
  currencyRateQuerySchema,
) {}

export class CurrencyRateResponseDto extends createZodDto(
  currencyRateResponseSchema,
) {}
