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
import type { CurrencyRateResponse } from 'pulpe-shared';
import {
  CurrencyRateQueryDto,
  CurrencyRateResponseDto,
} from './dto/currency-swagger.dto';
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
    type: CurrencyRateResponseDto,
  })
  async getRate(
    @Query() query: CurrencyRateQueryDto,
  ): Promise<CurrencyRateResponse> {
    const data = await this.currencyService.getRate(query.base, query.target);
    return { success: true, data };
  }
}
