import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@common/guards/auth.guard';
import { ErrorResponseDto } from '@common/dto/response.dto';
import { supportedCurrencySchema, type SupportedCurrency } from 'pulpe-shared';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { CurrencyService } from './currency.service';

@ApiTags('Currency')
@ApiBearerAuth()
@Controller({ path: 'currency', version: '1' })
@UseGuards(AuthGuard)
@ApiUnauthorizedResponse({
  description: 'Authentication required',
  type: ErrorResponseDto,
})
@ApiInternalServerErrorResponse({
  description: 'Internal server error',
  type: ErrorResponseDto,
})
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get('rate')
  @ApiOperation({
    summary: 'Get currency exchange rate',
    description: 'Returns the exchange rate between two supported currencies',
  })
  @ApiQuery({ name: 'base', enum: ['CHF', 'EUR'] })
  @ApiQuery({ name: 'target', enum: ['CHF', 'EUR'] })
  @ApiResponse({
    status: 200,
    description: 'Exchange rate retrieved successfully',
  })
  async getRate(@Query('base') base: string, @Query('target') target: string) {
    const parsedBase = supportedCurrencySchema.safeParse(base);
    const parsedTarget = supportedCurrencySchema.safeParse(target);

    if (!parsedBase.success || !parsedTarget.success) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: 'base and target must be supported currencies (CHF, EUR)',
      });
    }

    const data = await this.currencyService.getRate(
      parsedBase.data as SupportedCurrency,
      parsedTarget.data as SupportedCurrency,
    );

    return { success: true as const, data };
  }
}
