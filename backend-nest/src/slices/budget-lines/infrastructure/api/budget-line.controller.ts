import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@/common/guards/auth.guard';
import { User } from '@/common/decorators/user.decorator';
import { SupabaseClient } from '@/common/decorators/supabase-client.decorator';
import { PinoLogger } from 'nestjs-pino';
import {
  CreateBudgetLineDto,
  UpdateBudgetLineDto,
  BulkCreateBudgetLineDto,
  BudgetLineResponseDto,
  BudgetLineListResponseDto,
  BudgetLineDeleteResponseDto,
} from './dto/budget-line-swagger.dto';
import { CreateBudgetLineCommand } from '../../application/commands/create-budget-line.command';
import { UpdateBudgetLineCommand } from '../../application/commands/update-budget-line.command';
import { DeleteBudgetLineCommand } from '../../application/commands/delete-budget-line.command';
import { BulkCreateBudgetLinesCommand } from '../../application/commands/bulk-create-budget-lines.command';
import { GetBudgetLineQuery } from '../../application/queries/get-budget-line.query';
import { ListBudgetLinesQuery } from '../../application/queries/list-budget-lines.query';
import { GetBudgetLinesByBudgetQuery } from '../../application/queries/get-budget-lines-by-budget.query';
import { BudgetLineMapper } from '../mappers/budget-line.mapper';
import { ErrorResponseDto } from '@/common/dto/error-response.dto';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';

@ApiTags('budget-lines')
@Controller('api/v2/budget-lines')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class BudgetLineController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly budgetLineMapper: BudgetLineMapper,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BudgetLineController.name);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new budget line',
    description: 'Create a new budget line for a specific budget',
  })
  @ApiBody({ type: CreateBudgetLineDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Budget line successfully created',
    type: BudgetLineResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  async create(
    @Body() dto: CreateBudgetLineDto,
    @User('id') userId: string,
    @SupabaseClient() supabase: SupabaseClient,
  ): Promise<BudgetLineResponseDto> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'budget-line.create.start',
      userId,
      budgetId: dto.budgetId,
      name: dto.name,
    });

    const command = new CreateBudgetLineCommand(
      userId,
      dto.budgetId,
      dto.name,
      dto.amount,
      dto.kind,
      dto.recurrence,
      dto.templateLineId,
      dto.savingsGoalId,
      dto.isManuallyAdjusted,
    );

    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      const duration = performance.now() - startTime;
      this.logger.warn({
        operation: 'budget-line.create.failed',
        userId,
        error: result.error.message,
        duration,
      });
      throw result.error;
    }

    const budgetLine = result.getValue();
    const data = this.budgetLineMapper.toApi(budgetLine);

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'budget-line.create.success',
      userId,
      budgetLineId: budgetLine.id,
      duration,
    });

    return {
      success: true,
      data,
    };
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create multiple budget lines',
    description:
      'Create multiple budget lines for a specific budget in one operation',
  })
  @ApiBody({ type: BulkCreateBudgetLineDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Budget lines successfully created',
    type: BudgetLineListResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  async bulkCreate(
    @Body() dto: BulkCreateBudgetLineDto,
    @User('id') userId: string,
    @SupabaseClient() supabase: SupabaseClient,
  ): Promise<BudgetLineListResponseDto> {
    const startTime = performance.now();

    // Extract budget ID from first line (all should have same budget ID)
    const budgetId = dto.budgetLines[0]?.budgetId;

    this.logger.info({
      operation: 'budget-line.bulk-create.start',
      userId,
      budgetId,
      count: dto.budgetLines.length,
    });

    const command = new BulkCreateBudgetLinesCommand(
      userId,
      budgetId,
      dto.budgetLines.map((line) => ({
        name: line.name,
        amount: line.amount,
        kind: line.kind,
        recurrence: line.recurrence,
        templateLineId: line.templateLineId,
        savingsGoalId: line.savingsGoalId,
        isManuallyAdjusted: line.isManuallyAdjusted,
      })),
    );

    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      const duration = performance.now() - startTime;
      this.logger.warn({
        operation: 'budget-line.bulk-create.failed',
        userId,
        error: result.error.message,
        duration,
      });
      throw result.error;
    }

    const budgetLines = result.getValue();
    const data = this.budgetLineMapper.toApiList(budgetLines);

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'budget-line.bulk-create.success',
      userId,
      count: budgetLines.length,
      duration,
    });

    return {
      success: true,
      data,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List budget lines',
    description:
      'List all budget lines for the authenticated user with optional filters',
  })
  @ApiQuery({
    name: 'budgetId',
    required: false,
    description: 'Filter by budget ID',
  })
  @ApiQuery({
    name: 'templateLineId',
    required: false,
    description: 'Filter by template line ID',
  })
  @ApiQuery({
    name: 'savingsGoalId',
    required: false,
    description: 'Filter by savings goal ID',
  })
  @ApiQuery({
    name: 'kind',
    required: false,
    enum: ['fixed', 'envelope', 'goal'],
    description: 'Filter by kind',
  })
  @ApiQuery({
    name: 'recurrence',
    required: false,
    enum: ['monthly', 'yearly', 'one-time'],
    description: 'Filter by recurrence',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Budget lines retrieved successfully',
    type: BudgetLineListResponseDto,
  })
  async findAll(
    @User('id') userId: string,
    @Query('budgetId') budgetId?: string,
    @Query('templateLineId') templateLineId?: string,
    @Query('savingsGoalId') savingsGoalId?: string,
    @Query('kind') kind?: string,
    @Query('recurrence') recurrence?: string,
    @SupabaseClient() supabase?: SupabaseClient,
  ): Promise<BudgetLineListResponseDto> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'budget-line.find-all.start',
      userId,
      filters: { budgetId, templateLineId, savingsGoalId, kind, recurrence },
    });

    const query = new ListBudgetLinesQuery(userId, {
      budgetId,
      templateLineId,
      savingsGoalId,
      kind,
      recurrence,
    });

    const result = await this.queryBus.execute(query);

    if (result.isFailure) {
      const duration = performance.now() - startTime;
      this.logger.warn({
        operation: 'budget-line.find-all.failed',
        userId,
        error: result.error.message,
        duration,
      });
      throw result.error;
    }

    const budgetLines = result.getValue();
    const data = this.budgetLineMapper.toApiList(budgetLines);

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'budget-line.find-all.success',
      userId,
      count: budgetLines.length,
      duration,
    });

    return {
      success: true,
      data,
    };
  }

  @Get('budget/:budgetId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get budget lines by budget',
    description: 'Get all budget lines for a specific budget',
  })
  @ApiParam({ name: 'budgetId', description: 'Budget ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Budget lines retrieved successfully',
    type: BudgetLineListResponseDto,
  })
  async findByBudget(
    @Param('budgetId') budgetId: string,
    @User('id') userId: string,
    @SupabaseClient() supabase: SupabaseClient,
  ): Promise<BudgetLineListResponseDto> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'budget-line.find-by-budget.start',
      userId,
      budgetId,
    });

    const query = new GetBudgetLinesByBudgetQuery(budgetId, userId);
    const result = await this.queryBus.execute(query);

    if (result.isFailure) {
      const duration = performance.now() - startTime;
      this.logger.warn({
        operation: 'budget-line.find-by-budget.failed',
        userId,
        budgetId,
        error: result.error.message,
        duration,
      });
      throw result.error;
    }

    const budgetLines = result.getValue();
    const data = this.budgetLineMapper.toApiList(budgetLines);

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'budget-line.find-by-budget.success',
      userId,
      budgetId,
      count: budgetLines.length,
      duration,
    });

    return {
      success: true,
      data,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get a budget line by ID',
    description: 'Get a specific budget line by its ID',
  })
  @ApiParam({ name: 'id', description: 'Budget line ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Budget line retrieved successfully',
    type: BudgetLineResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Budget line not found',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('id') id: string,
    @User('id') userId: string,
    @SupabaseClient() supabase: SupabaseClient,
  ): Promise<BudgetLineResponseDto> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'budget-line.find-one.start',
      userId,
      budgetLineId: id,
    });

    const query = new GetBudgetLineQuery(id, userId);
    const result = await this.queryBus.execute(query);

    if (result.isFailure) {
      const duration = performance.now() - startTime;
      this.logger.warn({
        operation: 'budget-line.find-one.failed',
        userId,
        budgetLineId: id,
        error: result.error.message,
        duration,
      });
      throw result.error;
    }

    const budgetLine = result.getValue();
    if (!budgetLine) {
      throw new GenericDomainException(
        'Budget line not found',
        'BUDGET_LINE_NOT_FOUND',
        `Budget line with ID ${id} not found`,
      );
    }

    const data = this.budgetLineMapper.toApi(budgetLine);

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'budget-line.find-one.success',
      userId,
      budgetLineId: id,
      duration,
    });

    return {
      success: true,
      data,
    };
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a budget line',
    description: 'Update an existing budget line',
  })
  @ApiParam({ name: 'id', description: 'Budget line ID' })
  @ApiBody({ type: UpdateBudgetLineDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Budget line successfully updated',
    type: BudgetLineResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Budget line not found',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBudgetLineDto,
    @User('id') userId: string,
    @SupabaseClient() supabase: SupabaseClient,
  ): Promise<BudgetLineResponseDto> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'budget-line.update.start',
      userId,
      budgetLineId: id,
    });

    const command = new UpdateBudgetLineCommand(
      id,
      userId,
      dto.name,
      dto.amount,
      dto.kind,
      dto.recurrence,
      dto.savingsGoalId,
      dto.isManuallyAdjusted,
    );

    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      const duration = performance.now() - startTime;
      this.logger.warn({
        operation: 'budget-line.update.failed',
        userId,
        budgetLineId: id,
        error: result.error.message,
        duration,
      });
      throw result.error;
    }

    const budgetLine = result.getValue();
    const data = this.budgetLineMapper.toApi(budgetLine);

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'budget-line.update.success',
      userId,
      budgetLineId: id,
      duration,
    });

    return {
      success: true,
      data,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a budget line',
    description: 'Delete an existing budget line',
  })
  @ApiParam({ name: 'id', description: 'Budget line ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Budget line successfully deleted',
    type: BudgetLineDeleteResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Budget line not found',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('id') id: string,
    @User('id') userId: string,
    @SupabaseClient() supabase: SupabaseClient,
  ): Promise<BudgetLineDeleteResponseDto> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'budget-line.delete.start',
      userId,
      budgetLineId: id,
    });

    const command = new DeleteBudgetLineCommand(id, userId);
    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      const duration = performance.now() - startTime;
      this.logger.warn({
        operation: 'budget-line.delete.failed',
        userId,
        budgetLineId: id,
        error: result.error.message,
        duration,
      });
      throw result.error;
    }

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'budget-line.delete.success',
      userId,
      budgetLineId: id,
      duration,
    });

    return {
      success: true,
      message: 'Budget line deleted successfully',
    };
  }
}
