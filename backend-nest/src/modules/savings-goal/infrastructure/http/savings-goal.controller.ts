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
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import {
  type SavingsGoalResponse,
  type SavingsGoalListResponse,
  type SavingsGoalDeleteResponse,
  type SavingsGoalProgressResponse,
} from 'pulpe-shared';
import { AuthGuard } from '@common/guards/auth.guard';
import {
  User,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import { ErrorResponseDto } from '@common/dto/response.dto';
import {
  SavingsGoalCreateDto,
  SavingsGoalUpdateDto,
  SavingsGoalResponseDto,
  SavingsGoalListResponseDto,
  SavingsGoalDeleteResponseDto,
  SavingsGoalProgressResponseDto,
} from './dto/savings-goal-swagger.dto';
import { FindAllSavingsGoalsUseCase } from '../../application/find-all-savings-goals.use-case';
import { FindSavingsGoalUseCase } from '../../application/find-savings-goal.use-case';
import { CreateSavingsGoalUseCase } from '../../application/create-savings-goal.use-case';
import { UpdateSavingsGoalUseCase } from '../../application/update-savings-goal.use-case';
import { RemoveSavingsGoalUseCase } from '../../application/remove-savings-goal.use-case';
import { GetSavingsGoalProgressUseCase } from '../../application/get-savings-goal-progress.use-case';
import { SavingsGoalMapper } from '../mappers/savings-goal.mapper';

@ApiTags('Savings Goals')
@ApiBearerAuth()
@Controller({ path: 'savings-goals', version: '1' })
@UseGuards(AuthGuard)
@ApiUnauthorizedResponse({
  description: 'Authentication required',
  type: ErrorResponseDto,
})
@ApiInternalServerErrorResponse({
  description: 'Internal server error',
  type: ErrorResponseDto,
})
export class SavingsGoalController {
  constructor(
    private readonly findAllUseCase: FindAllSavingsGoalsUseCase,
    private readonly findOneUseCase: FindSavingsGoalUseCase,
    private readonly createUseCase: CreateSavingsGoalUseCase,
    private readonly updateUseCase: UpdateSavingsGoalUseCase,
    private readonly removeUseCase: RemoveSavingsGoalUseCase,
    private readonly progressUseCase: GetSavingsGoalProgressUseCase,
    private readonly mapper: SavingsGoalMapper,
  ) {}

  @Get()
  @ApiOperation({ summary: "Liste les objectifs d'épargne de l'utilisateur" })
  @ApiResponse({
    status: 200,
    description: 'Objectifs récupérés avec succès',
    type: SavingsGoalListResponseDto,
  })
  async findAll(
    @User() user: AuthenticatedUser,
  ): Promise<SavingsGoalListResponse> {
    const entities = await this.findAllUseCase.execute(user);
    return { success: true, data: this.mapper.toApiList(entities) };
  }

  @Post()
  @ApiOperation({ summary: "Crée un objectif d'épargne" })
  @ApiResponse({
    status: 201,
    description: 'Objectif créé avec succès',
    type: SavingsGoalResponseDto,
  })
  async create(
    @Body() createDto: SavingsGoalCreateDto,
    @User() user: AuthenticatedUser,
  ): Promise<SavingsGoalResponse> {
    const entity = await this.createUseCase.execute(createDto, user);
    return { success: true, data: this.mapper.toApi(entity) };
  }

  @Get(':id/progress')
  @ApiOperation({
    summary:
      "Progression d'un objectif — prévu cumulé, confirmé (pointé), rythme, projection (PUL-8)",
  })
  @ApiParam({ name: 'id', description: "Identifiant unique de l'objectif" })
  @ApiResponse({
    status: 200,
    description: 'Progression calculée avec succès',
    type: SavingsGoalProgressResponseDto,
  })
  async progress(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
  ): Promise<SavingsGoalProgressResponse> {
    const computation = await this.progressUseCase.execute(id, user);
    return { success: true, data: this.mapper.toProgressApi(computation) };
  }

  @Get(':id')
  @ApiOperation({ summary: "Récupère un objectif d'épargne par son ID" })
  @ApiParam({ name: 'id', description: "Identifiant unique de l'objectif" })
  @ApiResponse({
    status: 200,
    description: 'Objectif récupéré avec succès',
    type: SavingsGoalResponseDto,
  })
  async findOne(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
  ): Promise<SavingsGoalResponse> {
    const entity = await this.findOneUseCase.execute(id, user);
    return { success: true, data: this.mapper.toApi(entity) };
  }

  @Patch(':id')
  @ApiOperation({
    summary: "Modifie un objectif d'épargne (dont changement de statut)",
  })
  @ApiParam({ name: 'id', description: "Identifiant unique de l'objectif" })
  @ApiResponse({
    status: 200,
    description: 'Objectif modifié avec succès',
    type: SavingsGoalResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() updateDto: SavingsGoalUpdateDto,
    @User() user: AuthenticatedUser,
  ): Promise<SavingsGoalResponse> {
    const entity = await this.updateUseCase.execute(id, updateDto, user);
    return { success: true, data: this.mapper.toApi(entity) };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Supprime un objectif et délie ses prévisions (jamais supprimées)',
  })
  @ApiParam({ name: 'id', description: "Identifiant unique de l'objectif" })
  @ApiResponse({
    status: 200,
    description: 'Objectif supprimé avec succès',
    type: SavingsGoalDeleteResponseDto,
  })
  async remove(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
  ): Promise<SavingsGoalDeleteResponse> {
    await this.removeUseCase.execute(id, user);
    return { success: true, message: 'Savings goal deleted successfully' };
  }
}
