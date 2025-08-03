import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  ParseIntPipe,
  ParseBoolPipe,
  DefaultValuePipe,
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
  ApiCreatedResponse,
  ApiQuery,
} from '@nestjs/swagger';
import {
  type TransactionListResponse,
  type TransactionResponse,
  type TransactionDeleteResponse,
} from '@pulpe/shared';
import {
  User,
  SupabaseClient,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { ErrorResponseDto } from '@common/dto/response.dto';
import { LogOperation } from '@shared/infrastructure/logging/logging.decorators';
import { AuthRateLimit } from '@shared/infrastructure/security/throttler.decorators';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';

// Command and Query handlers
import { CreateTransactionHandler } from '../../application/handlers/create-transaction.handler';
import { UpdateTransactionHandler } from '../../application/handlers/update-transaction.handler';
import { DeleteTransactionHandler } from '../../application/handlers/delete-transaction.handler';
import { GetTransactionHandler } from '../../application/handlers/get-transaction.handler';
import { ListTransactionsHandler } from '../../application/handlers/list-transactions.handler';
import { GetTransactionsByBudgetHandler } from '../../application/handlers/get-transactions-by-budget.handler';
import { GetTransactionsByCategoryHandler } from '../../application/handlers/get-transactions-by-category.handler';
import { BulkImportTransactionsHandler } from '../../application/handlers/bulk-import-transactions.handler';

// Commands and Queries
import { CreateTransactionCommand } from '../../application/commands/create-transaction.command';
import { UpdateTransactionCommand } from '../../application/commands/update-transaction.command';
import { DeleteTransactionCommand } from '../../application/commands/delete-transaction.command';
import { GetTransactionQuery } from '../../application/queries/get-transaction.query';
import { ListTransactionsQuery } from '../../application/queries/list-transactions.query';
import { GetTransactionsByBudgetQuery } from '../../application/queries/get-transactions-by-budget.query';
import { GetTransactionsByCategoryQuery } from '../../application/queries/get-transactions-by-category.query';
import { BulkImportTransactionsCommand } from '../../application/commands/bulk-import-transactions.command';

// DTOs
import {
  TransactionCreateDto,
  TransactionUpdateDto,
  TransactionListResponseDto,
  TransactionResponseDto,
  TransactionDeleteResponseDto,
} from './dto/transaction-swagger.dto';

// Mapper and Repository
import { TransactionMapper } from '../mappers/transaction.mapper';
import { SupabaseTransactionRepository } from '../persistence/supabase-transaction.repository';

// Domain entities
import { Transaction } from '../../domain/entities/transaction.entity';
import { TransactionAmount } from '../../domain/value-objects/transaction-amount.value-object';

@ApiTags('Transactions v2')
@ApiBearerAuth()
@Controller('v2/transactions')
@AuthRateLimit()
@ApiUnauthorizedResponse({
  description: 'Authentication required',
  type: ErrorResponseDto,
})
@ApiInternalServerErrorResponse({
  description: 'Internal server error',
  type: ErrorResponseDto,
})
export class TransactionController {
  constructor(
    private readonly createHandler: CreateTransactionHandler,
    private readonly updateHandler: UpdateTransactionHandler,
    private readonly deleteHandler: DeleteTransactionHandler,
    private readonly getHandler: GetTransactionHandler,
    private readonly listHandler: ListTransactionsHandler,
    private readonly getByBudgetHandler: GetTransactionsByBudgetHandler,
    private readonly getByCategoryHandler: GetTransactionsByCategoryHandler,
    private readonly bulkImportHandler: BulkImportTransactionsHandler,
    private readonly repository: SupabaseTransactionRepository,
    private readonly mapper: TransactionMapper,
  ) {}

  @Get()
  @LogOperation('ListTransactions')
  @ApiOperation({
    summary: 'List all user transactions with filters',
    description: 'Retrieve transactions with optional filtering and pagination',
  })
  @ApiQuery({ name: 'budgetId', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'isOutOfBudget', required: false, type: Boolean })
  @ApiQuery({ name: 'kind', required: false, enum: ['expense', 'income'] })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'amountMin', required: false, type: Number })
  @ApiQuery({ name: 'amountMax', required: false, type: Number })
  @ApiQuery({ name: 'searchTerm', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, default: 50 })
  @ApiQuery({ name: 'offset', required: false, type: Number, default: 0 })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    enum: ['date', 'amount', 'name'],
    default: 'date',
  })
  @ApiQuery({
    name: 'orderDirection',
    required: false,
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
    type: TransactionListResponseDto,
  })
  async list(
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
    @Query('budgetId') budgetId?: string,
    @Query('category') category?: string,
    @Query('isOutOfBudget') isOutOfBudget?: string,
    @Query('kind') kind?: 'expense' | 'income',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('amountMin', new DefaultValuePipe(undefined), ParseIntPipe)
    amountMin?: number,
    @Query('amountMax', new DefaultValuePipe(undefined), ParseIntPipe)
    amountMax?: number,
    @Query('searchTerm') searchTerm?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number = 0,
    @Query('orderBy') orderBy?: 'date' | 'amount' | 'name',
    @Query('orderDirection') orderDirection?: 'asc' | 'desc',
  ): Promise<TransactionListResponse> {
    // Set authenticated client on repository
    this.repository.setSupabaseClient(supabase);

    const query = new ListTransactionsQuery(
      user.id,
      {
        budgetId,
        category,
        isOutOfBudget:
          isOutOfBudget === 'true'
            ? true
            : isOutOfBudget === 'false'
              ? false
              : undefined,
        kind,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        amountMin,
        amountMax,
        searchTerm,
      },
      {
        limit,
        offset,
        orderBy,
        orderDirection,
      },
    );

    const result = await this.listHandler.execute(query);
    if (result.isFail()) {
      throw result.error;
    }

    const { transactions } = result.value;
    const apiTransactions = transactions.map((t) =>
      this.mapper.toApi(
        Transaction.create(
          {
            budgetId: t.budgetId,
            amount: TransactionAmount.create(t.amount).value!,
            name: t.name,
            kind: t.kind,
            transactionDate: t.transactionDate,
            isOutOfBudget: t.isOutOfBudget,
            category: t.category,
          },
          t.id,
        ).value!,
      ),
    );

    return {
      success: true,
      data: apiTransactions,
    };
  }

  @Get('budget/:budgetId')
  @LogOperation('GetTransactionsByBudget')
  @ApiOperation({
    summary: 'Get all transactions for a specific budget',
  })
  @ApiParam({
    name: 'budgetId',
    description: 'Budget ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, default: 50 })
  @ApiQuery({ name: 'offset', required: false, type: Number, default: 0 })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
    type: TransactionListResponseDto,
  })
  async getByBudget(
    @Param('budgetId', ParseUUIDPipe) budgetId: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number = 0,
  ): Promise<TransactionListResponse> {
    this.repository.setSupabaseClient(supabase);

    const query = new GetTransactionsByBudgetQuery(budgetId, user.id, {
      limit,
      offset,
    });

    const result = await this.getByBudgetHandler.execute(query);
    if (result.isFail()) {
      throw result.error;
    }

    const apiTransactions = result.value.map((t) =>
      this.mapper.toApi(
        Transaction.create(
          {
            budgetId: t.budgetId,
            amount: TransactionAmount.create(t.amount).value!,
            name: t.name,
            kind: t.kind,
            transactionDate: t.transactionDate,
            isOutOfBudget: t.isOutOfBudget,
            category: t.category,
          },
          t.id,
        ).value!,
      ),
    );

    return {
      success: true,
      data: apiTransactions,
    };
  }

  @Post()
  @LogOperation('CreateTransaction')
  @ApiOperation({ summary: 'Create a new transaction' })
  @ApiCreatedResponse({
    description: 'Transaction created successfully',
    type: TransactionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  async create(
    @Body() createDto: TransactionCreateDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    this.repository.setSupabaseClient(supabase);

    const command = new CreateTransactionCommand(
      user.id,
      createDto.budgetId,
      createDto.amount,
      createDto.name,
      createDto.kind,
      createDto.transactionDate || new Date().toISOString(),
      createDto.isOutOfBudget || false,
      createDto.category ?? null,
    );

    const result = await this.createHandler.execute(command);
    if (result.isFail()) {
      throw result.error;
    }

    const transaction = Transaction.create(
      {
        budgetId: result.value.budgetId,
        amount: TransactionAmount.create(result.value.amount).value!,
        name: result.value.name,
        kind: result.value.kind,
        transactionDate: result.value.transactionDate,
        isOutOfBudget: result.value.isOutOfBudget,
        category: result.value.category,
      },
      result.value.id,
    ).value!;

    return {
      success: true,
      data: this.mapper.toApi(transaction),
    };
  }

  @Get(':id')
  @LogOperation('GetTransaction')
  @ApiOperation({ summary: 'Get a specific transaction by ID' })
  @ApiParam({
    name: 'id',
    description: 'Transaction ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction retrieved successfully',
    type: TransactionResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Transaction not found',
    type: ErrorResponseDto,
  })
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    this.repository.setSupabaseClient(supabase);

    const query = new GetTransactionQuery(id, user.id);
    const result = await this.getHandler.execute(query);
    if (result.isFail()) {
      throw result.error;
    }

    if (!result.value) {
      throw new GenericDomainException(
        'Transaction not found',
        'TRANSACTION_NOT_FOUND',
        `Transaction with ID ${id} not found`,
      );
    }

    const transaction = Transaction.create(
      {
        budgetId: result.value.budgetId,
        amount: TransactionAmount.create(result.value.amount).value!,
        name: result.value.name,
        kind: result.value.kind,
        transactionDate: result.value.transactionDate,
        isOutOfBudget: result.value.isOutOfBudget,
        category: result.value.category,
      },
      result.value.id,
    ).value!;

    return {
      success: true,
      data: this.mapper.toApi(transaction),
    };
  }

  @Patch(':id')
  @LogOperation('UpdateTransaction')
  @ApiOperation({ summary: 'Update an existing transaction' })
  @ApiParam({
    name: 'id',
    description: 'Transaction ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction updated successfully',
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
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: TransactionUpdateDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    this.repository.setSupabaseClient(supabase);

    const command = new UpdateTransactionCommand(
      id,
      user.id,
      updateDto.amount,
      updateDto.name,
      updateDto.kind,
      updateDto.transactionDate,
      updateDto.isOutOfBudget,
      updateDto.category,
    );

    const result = await this.updateHandler.execute(command);
    if (result.isFail()) {
      throw result.error;
    }

    const transaction = Transaction.create(
      {
        budgetId: result.value.budgetId,
        amount: TransactionAmount.create(result.value.amount).value!,
        name: result.value.name,
        kind: result.value.kind,
        transactionDate: result.value.transactionDate,
        isOutOfBudget: result.value.isOutOfBudget,
        category: result.value.category,
      },
      result.value.id,
    ).value!;

    return {
      success: true,
      data: this.mapper.toApi(transaction),
    };
  }

  @Delete(':id')
  @LogOperation('DeleteTransaction')
  @ApiOperation({ summary: 'Delete a transaction' })
  @ApiParam({
    name: 'id',
    description: 'Transaction ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction deleted successfully',
    type: TransactionDeleteResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Transaction not found',
    type: ErrorResponseDto,
  })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionDeleteResponse> {
    this.repository.setSupabaseClient(supabase);

    const command = new DeleteTransactionCommand(id, user.id);
    const result = await this.deleteHandler.execute(command);
    if (result.isFail()) {
      throw result.error;
    }

    return {
      success: true,
      data: {
        deleted: result.value.deleted,
        message: result.value.message,
      },
    };
  }

  @Post('bulk-import')
  @LogOperation('BulkImportTransactions')
  @ApiOperation({ summary: 'Bulk import transactions' })
  @ApiCreatedResponse({
    description: 'Transactions imported successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  async bulkImport(
    @Body() importDto: { transactions: TransactionCreateDto[] },
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<{
    success: boolean;
    data: any /* eslint-disable-line @typescript-eslint/no-explicit-any */;
  }> {
    this.repository.setSupabaseClient(supabase);

    const command = new BulkImportTransactionsCommand(
      user.id,
      importDto.transactions.map((dto) => ({
        budgetId: dto.budgetId,
        amount: dto.amount,
        name: dto.name,
        kind: dto.kind,
        transactionDate: dto.transactionDate || new Date().toISOString(),
        isOutOfBudget: dto.isOutOfBudget || false,
        category: dto.category ?? null,
      })),
    );

    const result = await this.bulkImportHandler.execute(command);
    if (result.isFail()) {
      throw result.error;
    }

    return {
      success: true,
      data: result.value,
    };
  }
}
