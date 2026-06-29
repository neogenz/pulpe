import {
  Inject,
  Controller,
  Post,
  Body,
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
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { type BudgetLineSpreadResponse } from 'pulpe-shared';
import { AuthGuard } from '@common/guards/auth.guard';
import {
  User,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import { ErrorResponseDto } from '@common/dto/response.dto';
import {
  TRANSACTION_SPREAD_FROM_TXN_PORT,
  type TransactionSpreadFromTxnPort,
} from '../../../transaction/domain/ports/transaction-spread-from-txn.port';
import { AllocationMapper } from '../mappers/allocation.mapper';
import {
  AllocationTransactionSpreadFromTxnCreateDto,
  AllocationTransactionSpreadResponseDto,
} from './dto/allocation-swagger.dto';

@ApiTags('Allocations')
@ApiBearerAuth()
@Controller({ path: 'transactions', version: '1' })
@UseGuards(AuthGuard)
@ApiUnauthorizedResponse({
  description: 'Authentication required',
  type: ErrorResponseDto,
})
@ApiInternalServerErrorResponse({
  description: 'Internal server error',
  type: ErrorResponseDto,
})
export class AllocationTransactionController {
  constructor(
    @Inject(TRANSACTION_SPREAD_FROM_TXN_PORT)
    private readonly spreadFromTxn: TransactionSpreadFromTxnPort,
    private readonly mapper: AllocationMapper,
  ) {}

  @Post(':id/spread')
  @ApiOperation({
    summary: 'Lisse une transaction libre existante sur plusieurs mois',
    description:
      "Redistribue le montant total d'un réel libre (non alloué) en N prévisions « Prévu » (one_off) de T/N (Σ = T) partageant un spread_group_id, une par mois choisi (mois courant inclus), puis SUPPRIME le réel source. Seul un réel libre non-revenu est éligible ; un réel alloué à une enveloppe dérive son lissage de sa ligne parente. Un mois cible sans budget ni template par défaut fait échouer toute l'opération.",
  })
  @ApiParam({
    name: 'id',
    description: 'Identifiant unique de la transaction libre source à lisser',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 201,
    description: 'Transaction libre lissée avec succès (source supprimée)',
    type: AllocationTransactionSpreadResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Transaction source non trouvée',
    type: ErrorResponseDto,
  })
  @HttpCode(HttpStatus.CREATED)
  async spreadFromTransaction(
    @Param('id') id: string,
    @Body() spreadFromTxnDto: AllocationTransactionSpreadFromTxnCreateDto,
    @User() user: AuthenticatedUser,
  ): Promise<BudgetLineSpreadResponse> {
    const result = await this.spreadFromTxn.spreadFromTransaction(
      id,
      spreadFromTxnDto,
      user,
    );
    return {
      success: true,
      data: {
        spreadGroupId: result.spreadGroupId,
        lines: this.mapper.toBudgetLineApiList(result.lines),
        createdBudgets: this.mapper.toBudgetApiList(result.createdBudgets),
        skippedMonths: result.skippedMonths,
      },
    };
  }
}
