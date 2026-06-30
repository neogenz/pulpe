import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
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
  TRANSACTION_SEARCH_QUERY_MAX_LENGTH,
  TRANSACTION_SEARCH_QUERY_MIN_LENGTH,
  transactionSearchQuerySchema,
  type TransactionResponse,
  type TransactionListResponse,
  type TransactionDeleteResponse,
  type TransactionSearchResponse,
  type BudgetLineSpreadResponse,
} from 'pulpe-shared';
import { AuthGuard } from '@common/guards/auth.guard';
import {
  User,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import {
  TransactionCreateDto,
  TransactionUpdateDto,
  TransactionResponseDto,
  TransactionListResponseDto,
  TransactionDeleteResponseDto,
  TransactionSearchResponseDto,
} from './dto/transaction-swagger.dto';
import {
  TransactionSpreadFromTxnCreateDto,
  TransactionSpreadResponseDto,
} from './dto/transaction-spread-swagger.dto';
import { ErrorResponseDto } from '@common/dto/response.dto';
import { FindAllTransactionsUseCase } from '../../application/find-all-transactions.use-case';
import { FindTransactionUseCase } from '../../application/find-transaction.use-case';
import { FindTransactionsByBudgetUseCase } from '../../application/find-transactions-by-budget.use-case';
import { FindTransactionsByBudgetLineUseCase } from '../../application/find-transactions-by-budget-line.use-case';
import { CreateTransactionUseCase } from '../../application/create-transaction.use-case';
import { UpdateTransactionUseCase } from '../../application/update-transaction.use-case';
import { RemoveTransactionUseCase } from '../../application/remove-transaction.use-case';
import { ToggleTransactionCheckUseCase } from '../../application/toggle-transaction-check.use-case';
import { SearchTransactionsUseCase } from '../../application/search-transactions.use-case';
import { SpreadTransactionFromTxnUseCase } from '../../application/spread-transaction-from-txn.use-case';
import { TransactionMapper } from '../mappers/transaction.mapper';
import { BudgetLineMapper } from '@modules/budget-line/infrastructure/mappers/budget-line.mapper';
import { BudgetMapper } from '@modules/budget/infrastructure/mappers/budget.mapper';

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
  // eslint-disable-next-line max-params
  constructor(
    private readonly findAllUseCase: FindAllTransactionsUseCase,
    private readonly findOneUseCase: FindTransactionUseCase,
    private readonly findByBudgetUseCase: FindTransactionsByBudgetUseCase,
    private readonly findByBudgetLineUseCase: FindTransactionsByBudgetLineUseCase,
    private readonly createUseCase: CreateTransactionUseCase,
    private readonly updateUseCase: UpdateTransactionUseCase,
    private readonly removeUseCase: RemoveTransactionUseCase,
    private readonly toggleCheckUseCase: ToggleTransactionCheckUseCase,
    private readonly searchUseCase: SearchTransactionsUseCase,
    private readonly spreadFromTxnUseCase: SpreadTransactionFromTxnUseCase,
    private readonly mapper: TransactionMapper,
    private readonly budgetLineMapper: BudgetLineMapper,
    private readonly budgetMapper: BudgetMapper,
  ) {}

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
  ): Promise<TransactionListResponse> {
    const entities = await this.findByBudgetUseCase.execute(budgetId, user);
    return { success: true, data: this.mapper.toApiList(entities) };
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
  ): Promise<TransactionListResponse> {
    const entities = await this.findByBudgetLineUseCase.execute(
      budgetLineId,
      user,
    );
    return { success: true, data: this.mapper.toApiList(entities) };
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
    description: 'Query invalide ou trop courte (minimum 2 caractères)',
    type: ErrorResponseDto,
  })
  async search(
    @Query('q') queryParam: unknown,
    @Query('years') yearsParam: string | string[] | undefined,
    @User() user: AuthenticatedUser,
  ): Promise<TransactionSearchResponse> {
    const query = this.parseSearchQuery(queryParam);
    const years = this.parseYearsParam(yearsParam);
    const results = await this.searchUseCase.execute(query, user, years);
    return { success: true, data: results };
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
  ): Promise<TransactionResponse> {
    const entity = await this.createUseCase.execute(createTransactionDto, user);
    return { success: true, data: this.mapper.toApi(entity) };
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
  ): Promise<TransactionResponse> {
    const entity = await this.findOneUseCase.execute(id, user);
    return { success: true, data: this.mapper.toApi(entity) };
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
  ): Promise<TransactionResponse> {
    const entity = await this.updateUseCase.execute(
      id,
      updateTransactionDto,
      user,
    );
    return { success: true, data: this.mapper.toApi(entity) };
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
  ): Promise<TransactionDeleteResponse> {
    await this.removeUseCase.execute(id, user);
    return { success: true, message: 'Transaction deleted successfully' };
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
  ): Promise<TransactionResponse> {
    const entity = await this.toggleCheckUseCase.execute(id, user);
    return { success: true, data: this.mapper.toApi(entity) };
  }

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
    type: TransactionSpreadResponseDto,
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
  async spreadFromTxn(
    @Param('id') id: string,
    @Body() spreadFromTxnDto: TransactionSpreadFromTxnCreateDto,
    @User() user: AuthenticatedUser,
  ): Promise<BudgetLineSpreadResponse> {
    const result = await this.spreadFromTxnUseCase.execute(
      id,
      spreadFromTxnDto,
      user,
    );
    return {
      success: true,
      data: {
        spreadGroupId: result.spreadGroupId,
        lines: this.budgetLineMapper.toApiList(result.lines),
        createdBudgets: this.budgetMapper.toApiList(result.createdBudgets),
        skippedMonths: result.skippedMonths,
      },
    };
  }

  private parseYearsParam(yearsParam: string | string[] | undefined): number[] {
    if (!yearsParam) return [];
    const arr = Array.isArray(yearsParam) ? yearsParam : [yearsParam];
    const maxYear = new Date().getFullYear() + 100;
    return arr
      .map((y) => parseInt(y, 10))
      .filter((y) => !isNaN(y) && y >= 1900 && y <= maxYear);
  }

  private parseSearchQuery(queryParam: unknown): string {
    if (queryParam === undefined) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
        { reason: 'Search query is required' },
      );
    }

    if (typeof queryParam !== 'string') {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
        { reason: 'Search query must be a string' },
      );
    }

    const parsed = transactionSearchQuerySchema.shape.q.safeParse(queryParam);

    if (parsed.success) {
      return parsed.data;
    }

    const issueCode = parsed.error.issues[0]?.code;

    if (issueCode === 'too_small') {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
        {
          reason: `Search query must be at least ${TRANSACTION_SEARCH_QUERY_MIN_LENGTH} characters`,
        },
      );
    }

    if (issueCode === 'too_big') {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
        {
          reason: `Search query must be at most ${TRANSACTION_SEARCH_QUERY_MAX_LENGTH} characters`,
        },
      );
    }

    throw new BusinessException(
      ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
      {
        reason: 'Search query is invalid',
      },
    );
  }
}
