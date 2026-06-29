import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import {
  type BudgetLineResponse,
  type BudgetLineListResponse,
  type BudgetLineDeleteResponse,
  type BudgetLineSpreadResponse,
} from 'pulpe-shared';
import { AuthGuard } from '@common/guards/auth.guard';
import {
  User,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import {
  BudgetLineCreateDto,
  BudgetLineUpdateDto,
  BudgetLineResponseDto,
  BudgetLineListResponseDto,
  BudgetLineDeleteResponseDto,
} from './dto/budget-line-swagger.dto';
import {
  BudgetLineSpreadCreateDto,
  BudgetLineSpreadFromLineCreateDto,
  BudgetLineSpreadResponseDto,
} from './dto/budget-line-spread-swagger.dto';
import { ErrorResponseDto } from '@common/dto/response.dto';
import { FindAllBudgetLinesUseCase } from '../../application/find-all-budget-lines.use-case';
import { FindBudgetLineUseCase } from '../../application/find-budget-line.use-case';
import { FindBudgetLinesByBudgetUseCase } from '../../application/find-budget-lines-by-budget.use-case';
import { CreateBudgetLineUseCase } from '../../application/create-budget-line.use-case';
import { CreateBudgetLineSpreadUseCase } from '../../application/create-budget-line-spread.use-case';
import { SpreadBudgetLineFromLineUseCase } from '../../application/spread-budget-line-from-line.use-case';
import { UpdateBudgetLineUseCase } from '../../application/update-budget-line.use-case';
import { RemoveBudgetLineUseCase } from '../../application/remove-budget-line.use-case';
import { ResetBudgetLineFromTemplateUseCase } from '../../application/reset-budget-line-from-template.use-case';
import { ToggleBudgetLineCheckUseCase } from '../../application/toggle-budget-line-check.use-case';
import { BudgetLineMapper } from '../mappers/budget-line.mapper';

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
  // eslint-disable-next-line max-params
  constructor(
    private readonly findAllUseCase: FindAllBudgetLinesUseCase,
    private readonly findOneUseCase: FindBudgetLineUseCase,
    private readonly findByBudgetUseCase: FindBudgetLinesByBudgetUseCase,
    private readonly createUseCase: CreateBudgetLineUseCase,
    private readonly createSpreadUseCase: CreateBudgetLineSpreadUseCase,
    private readonly spreadFromLineUseCase: SpreadBudgetLineFromLineUseCase,
    private readonly updateUseCase: UpdateBudgetLineUseCase,
    private readonly removeUseCase: RemoveBudgetLineUseCase,
    private readonly resetFromTemplateUseCase: ResetBudgetLineFromTemplateUseCase,
    private readonly toggleCheckUseCase: ToggleBudgetLineCheckUseCase,
    private readonly mapper: BudgetLineMapper,
  ) {}

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
  ): Promise<BudgetLineListResponse> {
    const entities = await this.findByBudgetUseCase.execute(budgetId, user);
    return { success: true, data: this.mapper.toApiList(entities) };
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
  ): Promise<BudgetLineResponse> {
    const entity = await this.createUseCase.execute(createBudgetLineDto, user);
    return { success: true, data: this.mapper.toApi(entity) };
  }

  @Post('spread')
  @ApiOperation({
    summary: 'Lisse une dépense sur plusieurs mois',
    description:
      'Crée N prévisions « Prévu » (one_off) indépendantes partageant un spread_group_id, une par tranche. Auto-crée les budgets manquants depuis le template par défaut ; les mois sans template sont renvoyés dans skippedMonths.',
  })
  @ApiResponse({
    status: 201,
    description: 'Dépense lissée créée avec succès',
    type: BudgetLineSpreadResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @HttpCode(HttpStatus.CREATED)
  async createSpread(
    @Body() createSpreadDto: BudgetLineSpreadCreateDto,
    @User() user: AuthenticatedUser,
  ): Promise<BudgetLineSpreadResponse> {
    const result = await this.createSpreadUseCase.execute(
      createSpreadDto,
      user,
    );
    return {
      success: true,
      data: {
        spreadGroupId: result.spreadGroupId,
        lines: this.mapper.toApiList(result.lines),
        createdBudgets: this.mapper.toBudgetApiList(result.createdBudgets),
        skippedMonths: result.skippedMonths,
      },
    };
  }

  @Post(':id/spread')
  @ApiOperation({
    summary:
      'Lisse une prévision existante sur plusieurs mois (total préservé)',
    description:
      "Redistribue le montant total de la prévision source en N tranches « Prévu » (one_off) de T/N (Σ = T), une par mois choisi (mois courant inclus), puis SUPPRIME la source. Le client n'envoie que les mois cibles ; le serveur lit le total. Un mois cible sans budget ni template par défaut fait échouer toute l'opération (aucune tranche créée).",
  })
  @ApiParam({
    name: 'id',
    description: 'Identifiant unique de la prévision source à lisser',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 201,
    description: 'Prévision lissée avec succès (source supprimée)',
    type: BudgetLineSpreadResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Prévision source non trouvée',
    type: ErrorResponseDto,
  })
  @HttpCode(HttpStatus.CREATED)
  async spreadFromLine(
    @Param('id') id: string,
    @Body() spreadFromLineDto: BudgetLineSpreadFromLineCreateDto,
    @User() user: AuthenticatedUser,
  ): Promise<BudgetLineSpreadResponse> {
    const result = await this.spreadFromLineUseCase.execute(
      id,
      spreadFromLineDto,
      user,
    );
    return {
      success: true,
      data: {
        spreadGroupId: result.spreadGroupId,
        lines: this.mapper.toApiList(result.lines),
        createdBudgets: this.mapper.toBudgetApiList(result.createdBudgets),
        skippedMonths: result.skippedMonths,
      },
    };
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
  ): Promise<BudgetLineResponse> {
    const entity = await this.findOneUseCase.execute(id, user);
    return { success: true, data: this.mapper.toApi(entity) };
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
  ): Promise<BudgetLineResponse> {
    const entity = await this.updateUseCase.execute(
      id,
      updateBudgetLineDto,
      user,
    );
    return { success: true, data: this.mapper.toApi(entity) };
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
  ): Promise<BudgetLineResponse> {
    const entity = await this.resetFromTemplateUseCase.execute(id, user);
    return { success: true, data: this.mapper.toApi(entity) };
  }

  @Post(':id/toggle-check')
  @ApiOperation({
    summary: "Bascule l'état pointé d'une ligne budgétaire",
    description:
      "Si la ligne n'est pas pointée (checked_at = null), la marque comme pointée avec la date actuelle. Si déjà pointée, la décoche (checked_at = null).",
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
  ): Promise<BudgetLineResponse> {
    const entity = await this.toggleCheckUseCase.execute(id, user);
    return { success: true, data: this.mapper.toApi(entity) };
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
  ): Promise<BudgetLineDeleteResponse> {
    await this.removeUseCase.execute(id, user);
    return { success: true, message: 'Budget line deleted successfully' };
  }
}
