import {
  Inject,
  Controller,
  Get,
  Post,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import {
  type SpreadOccurrencesResponse,
  type TransactionListResponse,
} from 'pulpe-shared';
import { AuthGuard } from '@common/guards/auth.guard';
import {
  User,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import { ErrorResponseDto } from '@common/dto/response.dto';
import { mapSpreadOccurrencesToApi } from '@common/utils/budget-line-api.mapper';
import { mapTransactionsToApi } from '@common/utils/transaction-api.mapper';
import {
  BUDGET_LINE_CHECK_TRANSACTIONS_PORT,
  BUDGET_LINE_SPREAD_OCCURRENCES_PORT,
  type BudgetLineCheckTransactionsPort,
  type BudgetLineSpreadOccurrencesPort,
} from '@modules/budget-line/domain/ports/budget-line-allocation.port';
import {
  AllocationSpreadOccurrencesResponseDto,
  AllocationTransactionListResponseDto,
} from './dto/allocation-swagger.dto';

@ApiTags('Allocations')
@ApiBearerAuth()
@Controller({ path: 'budget-lines', version: '1' })
@UseGuards(AuthGuard)
@ApiUnauthorizedResponse({
  description: 'Authentication required',
  type: ErrorResponseDto,
})
@ApiInternalServerErrorResponse({
  description: 'Internal server error',
  type: ErrorResponseDto,
})
export class AllocationBudgetLineController {
  constructor(
    @Inject(BUDGET_LINE_SPREAD_OCCURRENCES_PORT)
    private readonly spreadOccurrences: BudgetLineSpreadOccurrencesPort,
    @Inject(BUDGET_LINE_CHECK_TRANSACTIONS_PORT)
    private readonly checkTransactionsPort: BudgetLineCheckTransactionsPort,
  ) {}

  @Get('spread/:spreadGroupId')
  @ApiOperation({
    summary: "Liste les occurrences d'une dépense lissée sur tous ses mois",
  })
  @ApiParam({
    name: 'spreadGroupId',
    description: 'Identifiant du groupe de lissage',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Occurrences de la dépense lissée récupérées avec succès',
    type: AllocationSpreadOccurrencesResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Aucune occurrence pour ce groupe de lissage',
    type: ErrorResponseDto,
  })
  async findSpreadOccurrences(
    @Param('spreadGroupId') spreadGroupId: string,
    @User() user: AuthenticatedUser,
  ): Promise<SpreadOccurrencesResponse> {
    const occurrences = await this.spreadOccurrences.execute(
      spreadGroupId,
      user,
    );
    return {
      success: true,
      data: mapSpreadOccurrencesToApi(occurrences),
    };
  }

  @Post(':id/check-transactions')
  @ApiOperation({
    summary: 'Check all unchecked transactions for a budget line',
  })
  @ApiParam({
    name: 'id',
    description: 'Identifiant unique de la ligne budgétaire',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Transactions pointées avec succès',
    type: AllocationTransactionListResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Ligne budgétaire non trouvée',
    type: ErrorResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  async checkTransactions(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
  ): Promise<TransactionListResponse> {
    const entities = await this.checkTransactionsPort.execute(id, user);
    return {
      success: true,
      data: mapTransactionsToApi(entities),
    };
  }
}
