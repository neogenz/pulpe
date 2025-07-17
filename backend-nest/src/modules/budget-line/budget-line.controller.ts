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
} from '@pulpe/shared';
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
} from './dto/budget-line-swagger.dto';
import { ErrorResponseDto } from '@common/dto/response.dto';

@ApiTags('Budget Lines')
@ApiBearerAuth()
@Controller('budget-lines')
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
