import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import {
  type TransactionResponse,
  type TransactionListResponse,
  type TransactionDeleteResponse,
  type TransactionSearchResponse,
} from 'pulpe-shared';
import { AuthGuard } from '@common/guards/auth.guard';
import {
  User,
  SupabaseClient,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import { TransactionService } from './transaction.service';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  TransactionCreateDto,
  TransactionUpdateDto,
  TransactionResponseDto,
  TransactionListResponseDto,
  TransactionDeleteResponseDto,
  TransactionSearchResponseDto,
} from './dto/transaction-swagger.dto';
import { ErrorResponseDto } from '@common/dto/response.dto';

@ApiTags('Transactions')
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
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get('budget/:budgetId')
  @ApiOperation({ summary: "Liste toutes les transactions d'un budget" })
  @ApiParam({
    name: 'budgetId',
    description: 'Identifiant unique du budget',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des transactions récupérée avec succès',
    type: TransactionListResponseDto,
  })
  async findByBudget(
    @Param('budgetId') budgetId: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionListResponse> {
    return this.transactionService.findByBudgetId(budgetId, supabase);
  }

  @Get('budget-line/:budgetLineId')
  @ApiOperation({
    summary: 'Liste les transactions allouées à une ligne budgétaire',
  })
  @ApiParam({
    name: 'budgetLineId',
    description: 'Identifiant unique de la ligne budgétaire',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des transactions allouées récupérée avec succès',
    type: TransactionListResponseDto,
  })
  async findByBudgetLine(
    @Param('budgetLineId') budgetLineId: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionListResponse> {
    return this.transactionService.findByBudgetLineId(budgetLineId, supabase);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Recherche globale dans toutes les transactions',
    description:
      'Recherche par nom ou catégorie dans toutes les transactions de tous les budgets',
  })
  @ApiQuery({
    name: 'q',
    description: 'Terme de recherche (minimum 2 caractères)',
    required: true,
    example: 'Restaurant',
  })
  @ApiQuery({
    name: 'years',
    description: 'Filtrer par années (optionnel)',
    required: false,
    isArray: true,
    type: Number,
    example: [2024, 2025],
  })
  @ApiResponse({
    status: 200,
    description: 'Résultats de recherche',
    type: TransactionSearchResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Query trop courte (minimum 2 caractères)',
    type: ErrorResponseDto,
  })
  async search(
    @Query('q') query: string,
    @Query('years') yearsParam: string | string[] | undefined,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionSearchResponse> {
    if (!query || query.length < 2) {
      throw new BadRequestException(
        'Le terme de recherche doit contenir au moins 2 caractères',
      );
    }

    const years = this.#parseYearsParam(yearsParam);
    return this.transactionService.search(query, supabase, years);
  }

  #parseYearsParam(yearsParam: string | string[] | undefined): number[] {
    if (!yearsParam) return [];
    const arr = Array.isArray(yearsParam) ? yearsParam : [yearsParam];
    const maxYear = new Date().getFullYear() + 100;
    return arr
      .map((y) => parseInt(y, 10))
      .filter((y) => !isNaN(y) && y >= 1900 && y <= maxYear);
  }

  @Post()
  @ApiOperation({ summary: 'Crée une nouvelle transaction' })
  @ApiResponse({
    status: 201,
    description: 'Transaction créée avec succès',
    type: TransactionResponseDto,
  })
  async create(
    @Body() createTransactionDto: TransactionCreateDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    return this.transactionService.create(createTransactionDto, user, supabase);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupère une transaction spécifique par son ID' })
  @ApiParam({
    name: 'id',
    description: 'Identifiant unique de la transaction',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction récupérée avec succès',
    type: TransactionResponseDto,
  })
  async findOne(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    return this.transactionService.findOne(id, user, supabase);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Met à jour partiellement une transaction existante',
  })
  @ApiParam({
    name: 'id',
    description: 'Identifiant unique de la transaction',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction mise à jour avec succès',
    type: TransactionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Transaction not found',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() updateTransactionDto: TransactionUpdateDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    return this.transactionService.update(
      id,
      updateTransactionDto,
      user,
      supabase,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprime une transaction existante' })
  @ApiParam({
    name: 'id',
    description: 'Identifiant unique de la transaction',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction supprimée avec succès',
    type: TransactionDeleteResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Transaction not found',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionDeleteResponse> {
    return this.transactionService.remove(id, user, supabase);
  }

  @Post(':id/toggle-check')
  @ApiOperation({
    summary: 'Bascule le statut checked_at de la transaction',
    description:
      'Si checked_at est null, le définit à la date/heure actuelle. Sinon, le remet à null.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identifiant unique de la transaction',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Statut de la transaction basculé avec succès',
    type: TransactionResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Transaction not found',
    type: ErrorResponseDto,
  })
  async toggleCheck(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    return this.transactionService.toggleCheck(id, user, supabase);
  }
}
