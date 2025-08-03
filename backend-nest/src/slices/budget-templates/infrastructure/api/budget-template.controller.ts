import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { PinoLogger } from 'nestjs-pino';
import { User } from '@/common/decorators/user.decorator';
import { AuthGuard } from '@/common/guards/auth.guard';
import {
  BudgetTemplateDto,
  BudgetTemplateLineDto,
  CreateBudgetTemplateDto,
  UpdateBudgetTemplateDto,
  CreateBudgetTemplateLineDto,
  UpdateBudgetTemplateLineDto,
} from '@pulpe/shared';
import {
  BudgetTemplateSwaggerDto,
  BudgetTemplateLineSwaggerDto,
  CreateBudgetTemplateSwaggerDto,
  UpdateBudgetTemplateSwaggerDto,
  CreateBudgetTemplateLineSwaggerDto,
  UpdateBudgetTemplateLineSwaggerDto,
} from './dto/budget-template-swagger.dto';
import { BudgetTemplateMapper } from '../persistence/budget-template.mapper';
import { CreateBudgetTemplateCommand } from '../../application/commands/create-budget-template.command';
import { UpdateBudgetTemplateCommand } from '../../application/commands/update-budget-template.command';
import { DeleteBudgetTemplateCommand } from '../../application/commands/delete-budget-template.command';
import { DuplicateBudgetTemplateCommand } from '../../application/commands/duplicate-budget-template.command';
import { AddTemplateLineCommand } from '../../application/commands/add-template-line.command';
import { UpdateTemplateLineCommand } from '../../application/commands/update-template-line.command';
import { DeleteTemplateLineCommand } from '../../application/commands/delete-template-line.command';
import { GetBudgetTemplateQuery } from '../../application/queries/get-budget-template.query';
import { ListBudgetTemplatesQuery } from '../../application/queries/list-budget-templates.query';
import { GetTemplateLinesQuery } from '../../application/queries/get-template-lines.query';

@ApiTags('Budget Templates')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('/v2/budget-templates')
export class BudgetTemplateController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: BudgetTemplateMapper,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BudgetTemplateController.name);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new budget template' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The budget template has been successfully created.',
    type: BudgetTemplateSwaggerDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data.',
  })
  async create(
    @User('id') userId: string,
    @Body() dto: CreateBudgetTemplateSwaggerDto,
  ): Promise<BudgetTemplateDto> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'create-budget-template.request',
      userId,
      templateName: dto.name,
    });

    const commandData = this.mapper.fromCreateDto(dto);
    const command = new CreateBudgetTemplateCommand(
      userId,
      commandData.name,
      commandData.description,
      commandData.isDefault,
      commandData.lines,
    );

    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      throw result.error;
    }

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'create-budget-template.response',
      userId,
      templateId: result.getValue().id,
      duration,
    });

    return this.mapper.toApi(result.getValue());
  }

  @Get()
  @ApiOperation({
    summary: 'List all budget templates for the authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of budget templates.',
    type: [BudgetTemplateSwaggerDto],
  })
  async list(@User('id') userId: string): Promise<BudgetTemplateDto[]> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'list-budget-templates.request',
      userId,
    });

    const query = new ListBudgetTemplatesQuery(userId);
    const result = await this.queryBus.execute(query);

    if (result.isFailure) {
      throw result.error;
    }

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'list-budget-templates.response',
      userId,
      count: result.getValue().length,
      duration,
    });

    return this.mapper.toApiList(result.getValue());
  }

  @Get(':templateId')
  @ApiOperation({ summary: 'Get a specific budget template' })
  @ApiParam({ name: 'templateId', description: 'Budget template ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The budget template details.',
    type: BudgetTemplateSwaggerDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Budget template not found.',
  })
  async get(
    @User('id') userId: string,
    @Param('templateId') templateId: string,
  ): Promise<BudgetTemplateDto> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'get-budget-template.request',
      userId,
      templateId,
    });

    const query = new GetBudgetTemplateQuery(userId, templateId);
    const result = await this.queryBus.execute(query);

    if (result.isFailure) {
      throw result.error;
    }

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'get-budget-template.response',
      userId,
      templateId,
      duration,
    });

    return this.mapper.toApi(result.getValue());
  }

  @Put(':templateId')
  @ApiOperation({ summary: 'Update a budget template' })
  @ApiParam({ name: 'templateId', description: 'Budget template ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The budget template has been successfully updated.',
    type: BudgetTemplateSwaggerDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Budget template not found.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data.',
  })
  async update(
    @User('id') userId: string,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateBudgetTemplateSwaggerDto,
  ): Promise<BudgetTemplateDto> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'update-budget-template.request',
      userId,
      templateId,
    });

    const commandData = this.mapper.fromUpdateDto(dto);
    const command = new UpdateBudgetTemplateCommand(
      userId,
      templateId,
      commandData.name,
      commandData.description,
      commandData.isDefault,
    );

    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      throw result.error;
    }

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'update-budget-template.response',
      userId,
      templateId,
      duration,
    });

    return this.mapper.toApi(result.getValue());
  }

  @Delete(':templateId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a budget template' })
  @ApiParam({ name: 'templateId', description: 'Budget template ID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'The budget template has been successfully deleted.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Budget template not found.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot delete default template.',
  })
  async delete(
    @User('id') userId: string,
    @Param('templateId') templateId: string,
  ): Promise<void> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'delete-budget-template.request',
      userId,
      templateId,
    });

    const command = new DeleteBudgetTemplateCommand(userId, templateId);
    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      throw result.error;
    }

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'delete-budget-template.response',
      userId,
      templateId,
      duration,
    });
  }

  @Post(':templateId/duplicate')
  @ApiOperation({ summary: 'Duplicate a budget template' })
  @ApiParam({
    name: 'templateId',
    description: 'Budget template ID to duplicate',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The budget template has been successfully duplicated.',
    type: BudgetTemplateSwaggerDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Budget template not found.',
  })
  async duplicate(
    @User('id') userId: string,
    @Param('templateId') templateId: string,
    @Body() dto: { newName: string },
  ): Promise<BudgetTemplateDto> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'duplicate-budget-template.request',
      userId,
      templateId,
      newName: dto.newName,
    });

    const command = new DuplicateBudgetTemplateCommand(
      userId,
      templateId,
      dto.newName,
    );

    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      throw result.error;
    }

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'duplicate-budget-template.response',
      userId,
      originalTemplateId: templateId,
      newTemplateId: result.getValue().id,
      duration,
    });

    return this.mapper.toApi(result.getValue());
  }

  @Get(':templateId/lines')
  @ApiOperation({ summary: 'Get all lines for a budget template' })
  @ApiParam({ name: 'templateId', description: 'Budget template ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of template lines.',
    type: [BudgetTemplateLineSwaggerDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Budget template not found.',
  })
  async getLines(
    @User('id') userId: string,
    @Param('templateId') templateId: string,
  ): Promise<BudgetTemplateLineDto[]> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'get-template-lines.request',
      userId,
      templateId,
    });

    const query = new GetTemplateLinesQuery(userId, templateId);
    const result = await this.queryBus.execute(query);

    if (result.isFailure) {
      throw result.error;
    }

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'get-template-lines.response',
      userId,
      templateId,
      count: result.getValue().length,
      duration,
    });

    return result.getValue().map((line) => this.mapper.lineToApi(line));
  }

  @Post(':templateId/lines')
  @ApiOperation({ summary: 'Add a new line to a budget template' })
  @ApiParam({ name: 'templateId', description: 'Budget template ID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The template line has been successfully created.',
    type: BudgetTemplateLineSwaggerDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Budget template not found.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data.',
  })
  async addLine(
    @User('id') userId: string,
    @Param('templateId') templateId: string,
    @Body() dto: CreateBudgetTemplateLineSwaggerDto,
  ): Promise<BudgetTemplateLineDto> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'add-template-line.request',
      userId,
      templateId,
      lineName: dto.name,
    });

    const commandData = this.mapper.fromCreateLineDto(dto);
    const command = new AddTemplateLineCommand(
      userId,
      templateId,
      commandData.name,
      commandData.amount,
      commandData.kind,
      commandData.recurrence,
      commandData.description,
    );

    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      throw result.error;
    }

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'add-template-line.response',
      userId,
      templateId,
      lineId: result.getValue().id,
      duration,
    });

    return this.mapper.lineToApi(result.getValue());
  }

  @Put(':templateId/lines/:lineId')
  @ApiOperation({ summary: 'Update a template line' })
  @ApiParam({ name: 'templateId', description: 'Budget template ID' })
  @ApiParam({ name: 'lineId', description: 'Template line ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The template line has been successfully updated.',
    type: BudgetTemplateLineSwaggerDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Template or line not found.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data.',
  })
  async updateLine(
    @User('id') userId: string,
    @Param('templateId') templateId: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateBudgetTemplateLineSwaggerDto,
  ): Promise<BudgetTemplateLineDto> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'update-template-line.request',
      userId,
      templateId,
      lineId,
    });

    const commandData = this.mapper.fromUpdateLineDto(dto);
    const command = new UpdateTemplateLineCommand(
      userId,
      templateId,
      lineId,
      commandData.name,
      commandData.amount,
      commandData.kind,
      commandData.recurrence,
      commandData.description,
    );

    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      throw result.error;
    }

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'update-template-line.response',
      userId,
      templateId,
      lineId,
      duration,
    });

    return this.mapper.lineToApi(result.getValue());
  }

  @Delete(':templateId/lines/:lineId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a template line' })
  @ApiParam({ name: 'templateId', description: 'Budget template ID' })
  @ApiParam({ name: 'lineId', description: 'Template line ID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'The template line has been successfully deleted.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Template or line not found.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot delete last line from template.',
  })
  async deleteLine(
    @User('id') userId: string,
    @Param('templateId') templateId: string,
    @Param('lineId') lineId: string,
  ): Promise<void> {
    const startTime = performance.now();

    this.logger.info({
      operation: 'delete-template-line.request',
      userId,
      templateId,
      lineId,
    });

    const command = new DeleteTemplateLineCommand(userId, templateId, lineId);
    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      throw result.error;
    }

    const duration = performance.now() - startTime;
    this.logger.info({
      operation: 'delete-template-line.response',
      userId,
      templateId,
      lineId,
      duration,
    });
  }
}
