import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type {
  ReconciliationContextResponse,
  ReconciliationStateResponse,
} from 'pulpe-shared';
import { AuthGuard } from '@common/guards/auth.guard';
import {
  User,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import { ErrorResponseDto } from '@common/dto/response.dto';
import { GetReconciliationContextUseCase } from '../../application/get-reconciliation-context.use-case';
import { UpdateReconciliationStateUseCase } from '../../application/update-reconciliation-state.use-case';
import {
  ReconciliationContextResponseDto,
  ReconciliationStateResponseDto,
  UpdateReconciliationStateDto,
} from './dto/reconciliation-swagger.dto';

@ApiTags('Reconciliation')
@ApiBearerAuth()
@Controller({ path: 'reconciliation', version: '1' })
@UseGuards(AuthGuard)
@ApiUnauthorizedResponse({
  description: 'Authentication required',
  type: ErrorResponseDto,
})
@ApiInternalServerErrorResponse({
  description: 'Internal server error',
  type: ErrorResponseDto,
})
export class ReconciliationController {
  constructor(
    private readonly getContextUseCase: GetReconciliationContextUseCase,
    private readonly updateStateUseCase: UpdateReconciliationStateUseCase,
  ) {}

  @Put('state')
  @ApiOperation({
    summary: 'Enregistre l’état de la comparaison',
    description:
      'Le montant de départ et/ou la fin d’une comparaison. Un champ absent reste inchangé.',
  })
  @ApiResponse({
    status: 200,
    description: 'État enregistré avec succès',
    type: ReconciliationStateResponseDto,
  })
  async updateState(
    @Body() dto: UpdateReconciliationStateDto,
    @User() user: AuthenticatedUser,
  ): Promise<ReconciliationStateResponse> {
    const data = await this.updateStateUseCase.execute(dto, user);
    return { success: true, data };
  }

  @Get(':budgetId')
  @ApiOperation({
    summary: 'Lit le contexte de la comparaison pour un budget',
  })
  @ApiParam({ name: 'budgetId', description: 'Identifiant du budget' })
  @ApiResponse({
    status: 200,
    description: 'Contexte récupéré avec succès',
    type: ReconciliationContextResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Budget introuvable',
    type: ErrorResponseDto,
  })
  async getContext(
    @Param('budgetId', ParseUUIDPipe) budgetId: string,
  ): Promise<ReconciliationContextResponse> {
    return {
      success: true,
      data: await this.getContextUseCase.execute(budgetId),
    };
  }
}
