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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import {
  type SavingsGoalResponse,
  type SavingsGoalListResponse,
  type SavingsGoalDeleteResponse,
  type SavingsGoalProgressResponse,
  type SavingsGoalContributionsResponse,
  type SavingsGoalPlanApplyResponse,
  type SavingsGoalFutureLinesResponse,
  type SavingsGoalGenerationStopResponse,
  type SavingsGoalDeletionImpactResponse,
  type SavingsGoalWithdrawalOptionsResponse,
  type SavingsGoalWithdrawalsResponse,
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
  SavingsGoalContributionsResponseDto,
  SavingsGoalPlanApplyDto,
  SavingsGoalPlanApplyResponseDto,
  SavingsGoalFutureLinesResponseDto,
  SavingsGoalFutureLinesQueryDto,
  SavingsGoalGenerationStopDto,
  SavingsGoalGenerationStopResponseDto,
  SavingsGoalDeletionCommandDto,
  SavingsGoalDeletionImpactResponseDto,
  SavingsGoalWithdrawalOptionsResponseDto,
  SavingsGoalWithdrawalsResponseDto,
} from './dto/savings-goal-swagger.dto';
import { FindAllSavingsGoalsUseCase } from '../../application/find-all-savings-goals.use-case';
import { FindSavingsGoalUseCase } from '../../application/find-savings-goal.use-case';
import { CreateSavingsGoalUseCase } from '../../application/create-savings-goal.use-case';
import { UpdateSavingsGoalUseCase } from '../../application/update-savings-goal.use-case';
import { RemoveSavingsGoalUseCase } from '../../application/remove-savings-goal.use-case';
import { GetSavingsGoalProgressUseCase } from '../../application/get-savings-goal-progress.use-case';
import { GetSavingsGoalContributionsUseCase } from '../../application/get-savings-goal-contributions.use-case';
import { ApplySavingsGoalPlanUseCase } from '../../application/apply-savings-goal-plan.use-case';
import { GetSavingsGoalFutureLinesUseCase } from '../../application/get-savings-goal-future-lines.use-case';
import { ApplySavingsGoalGenerationStopUseCase } from '../../application/apply-savings-goal-generation-stop.use-case';
import { GetSavingsGoalDeletionImpactUseCase } from '../../application/get-savings-goal-deletion-impact.use-case';
import { GetSavingsGoalWithdrawalOptionsUseCase } from '../../application/get-savings-goal-withdrawal-options.use-case';
import { GetSavingsGoalWithdrawalsUseCase } from '../../application/get-savings-goal-withdrawals.use-case';
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
    private readonly contributionsUseCase: GetSavingsGoalContributionsUseCase,
    private readonly applyPlanUseCase: ApplySavingsGoalPlanUseCase,
    private readonly futureLinesUseCase: GetSavingsGoalFutureLinesUseCase,
    private readonly generationStopUseCase: ApplySavingsGoalGenerationStopUseCase,
    private readonly deletionImpactUseCase: GetSavingsGoalDeletionImpactUseCase,
    private readonly withdrawalOptionsUseCase: GetSavingsGoalWithdrawalOptionsUseCase,
    private readonly withdrawalsUseCase: GetSavingsGoalWithdrawalsUseCase,
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

  // DÉCLARÉE AVANT toute route paramétrée : `:id` avalerait
  // `withdrawal-options` et chercherait un objectif portant ce nom.
  @Get('withdrawal-options')
  @ApiOperation({
    summary:
      "Objectifs proposables comme origine d'un revenu — solde disponible strictement positif (PUL-329)",
  })
  @ApiResponse({
    status: 200,
    description: 'Origines de retrait récupérées avec succès',
    type: SavingsGoalWithdrawalOptionsResponseDto,
  })
  async withdrawalOptions(
    @User() user: AuthenticatedUser,
  ): Promise<SavingsGoalWithdrawalOptionsResponse> {
    const options = await this.withdrawalOptionsUseCase.execute(user);
    return { success: true, data: options };
  }

  @Get(':id/withdrawals')
  @ApiOperation({
    summary:
      "Retraits d'un objectif — revenus dont l'argent est sorti du pot, du plus récent au plus ancien (PUL-329)",
  })
  @ApiParam({ name: 'id', description: "Identifiant unique de l'objectif" })
  @ApiResponse({
    status: 200,
    description: 'Retraits récupérés avec succès',
    type: SavingsGoalWithdrawalsResponseDto,
  })
  async withdrawals(
    @Param('id') id: string,
  ): Promise<SavingsGoalWithdrawalsResponse> {
    const readModel = await this.withdrawalsUseCase.execute(id);
    return {
      success: true,
      data: readModel.withdrawals,
      planned: readModel.planned,
      planOnly: readModel.planOnly,
    };
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

  @Get(':id/contributions')
  @ApiOperation({
    summary:
      'Contributions à un objectif — prévisions liées + leurs transactions, groupées par ligne (PUL-12)',
  })
  @ApiParam({ name: 'id', description: "Identifiant unique de l'objectif" })
  @ApiResponse({
    status: 200,
    description: 'Contributions récupérées avec succès',
    type: SavingsGoalContributionsResponseDto,
  })
  async contributions(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
  ): Promise<SavingsGoalContributionsResponse> {
    const contributions = await this.contributionsUseCase.execute(id, user);
    return {
      success: true,
      data: this.mapper.toContributionsApi(contributions),
    };
  }

  @Post(':id/plan')
  @ApiOperation({
    summary:
      'Applique un plan simulé aux prévisions liées non pointées (PUL-12)',
  })
  @ApiParam({ name: 'id', description: "Identifiant unique de l'objectif" })
  @ApiResponse({
    status: 201,
    description: 'Plan appliqué avec succès',
    type: SavingsGoalPlanApplyResponseDto,
  })
  async applyPlan(
    @Param('id') id: string,
    @Body() applyDto: SavingsGoalPlanApplyDto,
    @User() user: AuthenticatedUser,
  ): Promise<SavingsGoalPlanApplyResponse> {
    const result = await this.applyPlanUseCase.execute(id, applyDto, user);
    return {
      success: true,
      data: {
        updatedLines: result.updatedLines,
      },
    };
  }

  @Get(':id/future-lines')
  @ApiOperation({
    summary:
      'Prévisions liées futures candidates à figer/retirer à l’arrêt de génération (PUL-285)',
  })
  @ApiParam({ name: 'id', description: "Identifiant unique de l'objectif" })
  @ApiQuery({
    name: 'targetDate',
    required: false,
    description:
      'Échéance proposée : limite la preview aux cycles strictement postérieurs',
  })
  @ApiResponse({
    status: 200,
    description: 'Candidates récupérées avec succès',
    type: SavingsGoalFutureLinesResponseDto,
  })
  async futureLines(
    @Param('id') id: string,
    @Query() query: SavingsGoalFutureLinesQueryDto,
    @User() user: AuthenticatedUser,
  ): Promise<SavingsGoalFutureLinesResponse> {
    const lines = await this.futureLinesUseCase.execute(
      id,
      user,
      query.targetDate,
    );
    return { success: true, data: this.mapper.toFutureLinesApi(lines) };
  }

  @Post(':id/generation-stop')
  @ApiOperation({
    summary:
      'Applique la décision advisory figer/retirer sur les prévisions liées futures (PUL-285)',
  })
  @ApiParam({ name: 'id', description: "Identifiant unique de l'objectif" })
  @ApiResponse({
    status: 201,
    description: 'Décision appliquée avec succès',
    type: SavingsGoalGenerationStopResponseDto,
  })
  async generationStop(
    @Param('id') id: string,
    @Body() stopDto: SavingsGoalGenerationStopDto,
    @User() user: AuthenticatedUser,
  ): Promise<SavingsGoalGenerationStopResponse> {
    const result = await this.generationStopUseCase.execute(id, stopDto, user);
    return { success: true, data: result };
  }

  @Get(':id/deletion-impact')
  @ApiOperation({
    summary:
      "Prévisualise toutes les prévisions et transactions affectées par la suppression de l'objectif (PUL-319)",
  })
  @ApiParam({ name: 'id', description: "Identifiant unique de l'objectif" })
  @ApiResponse({
    status: 200,
    description: 'Impact de suppression récupéré avec succès',
    type: SavingsGoalDeletionImpactResponseDto,
  })
  async deletionImpact(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
  ): Promise<SavingsGoalDeletionImpactResponse> {
    const impact = await this.deletionImpactUseCase.execute(id, user);
    return { success: true, data: this.mapper.toDeletionImpactApi(impact) };
  }

  @Post(':id/deletion')
  @ApiOperation({
    summary:
      "Supprime l'objectif selon le périmètre prévisualisé et validé (PUL-319)",
  })
  @ApiParam({ name: 'id', description: "Identifiant unique de l'objectif" })
  @ApiResponse({
    status: 201,
    description: 'Objectif supprimé avec succès',
    type: SavingsGoalDeleteResponseDto,
  })
  async removeWithImpact(
    @Param('id') id: string,
    @Body() command: SavingsGoalDeletionCommandDto,
    @User() user: AuthenticatedUser,
  ): Promise<SavingsGoalDeleteResponse> {
    await this.removeUseCase.execute(id, user, command);
    return { success: true, message: 'Savings goal deleted successfully' };
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
