import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import {
  type BudgetLineResponse,
  type BudgetLineListResponse,
  type BudgetLineDeleteResponse,
  type TransactionListResponse,
} from 'pulpe-shared';
import { AuthGuard } from '@common/guards/auth.guard';
import {
  User,
  SupabaseClient,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import { BudgetLineService } from './budget-line.service';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  BudgetLineCreateDto,
  BudgetLineUpdateDto,
  BudgetLineResponseDto,
  BudgetLineListResponseDto,
  BudgetLineDeleteResponseDto,
  TransactionListResponseDto,
} from './dto/budget-line-swagger.dto';
import { ErrorResponseDto } from '@common/dto/response.dto';

@ApiTags('Budget Lines')
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
export class BudgetLineController {
  constructor(private readonly budgetLineService: BudgetLineService) {}

  @Get('budget/:budgetId')
  @ApiOperation({ summary: "Liste toutes les lignes budgétaires d'un budget" })
  @ApiParam({
    name: 'budgetId',
    description: 'Identifiant unique du budget',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des lignes budgétaires récupérée avec succès',
    type: BudgetLineListResponseDto,
  })
  async findByBudget(
    @Param('budgetId') budgetId: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineListResponse> {
    return this.budgetLineService.findByBudgetId(budgetId, supabase);
  }

  @Post()
  @ApiOperation({ summary: 'Crée une nouvelle ligne budgétaire' })
  @ApiResponse({
    status: 201,
    description: 'Ligne budgétaire créée avec succès',
    type: BudgetLineResponseDto,
  })
  async create(
    @Body() createBudgetLineDto: BudgetLineCreateDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineResponse> {
    return this.budgetLineService.create(createBudgetLineDto, user, supabase);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupère une ligne budgétaire spécifique par son ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Identifiant unique de la ligne budgétaire',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Ligne budgétaire récupérée avec succès',
    type: BudgetLineResponseDto,
  })
  async findOne(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineResponse> {
    return this.budgetLineService.findOne(id, user, supabase);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Met à jour partiellement une ligne budgétaire existante',
  })
  @ApiParam({
    name: 'id',
    description: 'Identifiant unique de la ligne budgétaire',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Ligne budgétaire mise à jour avec succès',
    type: BudgetLineResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Budget line not found',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() updateBudgetLineDto: BudgetLineUpdateDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineResponse> {
    return this.budgetLineService.update(
      id,
      updateBudgetLineDto,
      user,
      supabase,
    );
  }

  @Post(':id/reset-from-template')
  @ApiOperation({
    summary: 'Réinitialise une ligne budgétaire depuis son modèle',
    description:
      'Restaure les valeurs de la ligne budgétaire (nom, montant, type, récurrence) depuis le modèle associé et désactive le verrouillage manuel',
  })
  @ApiParam({
    name: 'id',
    description: 'Identifiant unique de la ligne budgétaire',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Ligne budgétaire réinitialisée avec succès',
    type: BudgetLineResponseDto,
  })
  @ApiBadRequestResponse({
    description: "La ligne budgétaire n'a pas de modèle associé",
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Ligne budgétaire ou modèle non trouvé',
    type: ErrorResponseDto,
  })
  async resetFromTemplate(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineResponse> {
    return this.budgetLineService.resetFromTemplate(id, user, supabase);
  }

  @Post(':id/toggle-check')
  @ApiOperation({
    summary: "Bascule l'état coché d'une ligne budgétaire",
    description:
      "Si la ligne n'est pas cochée (checked_at = null), la marque comme cochée avec la date actuelle. Si déjà cochée, la décoche (checked_at = null).",
  })
  @ApiParam({
    name: 'id',
    description: 'Identifiant unique de la ligne budgétaire',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'État de la ligne budgétaire basculé avec succès',
    type: BudgetLineResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Ligne budgétaire non trouvée',
    type: ErrorResponseDto,
  })
  async toggleCheck(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineResponse> {
    return this.budgetLineService.toggleCheck(id, user, supabase);
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
    description: 'Transactions cochées avec succès',
    type: TransactionListResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Ligne budgétaire non trouvée',
    type: ErrorResponseDto,
  })
  async checkTransactions(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionListResponse> {
    return this.budgetLineService.checkTransactions(id, user, supabase);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprime une ligne budgétaire existante' })
  @ApiParam({
    name: 'id',
    description: 'Identifiant unique de la ligne budgétaire',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Ligne budgétaire supprimée avec succès',
    type: BudgetLineDeleteResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Budget line not found',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineDeleteResponse> {
    return this.budgetLineService.remove(id, user, supabase);
  }
}
