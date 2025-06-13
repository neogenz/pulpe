import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import {
  transactionCreateSchema,
  transactionUpdateSchema,
  type TransactionCreate,
  type TransactionUpdate,
  type TransactionResponse,
} from '@pulpe/shared';
import { AuthGuard } from '@common/guards/auth.guard';
import { ZodBodyPipe } from '@common/pipes/zod-validation.pipe';
import { User, SupabaseClient, type AuthenticatedUser } from '@common/decorators/user.decorator';
import { TransactionService } from './transaction.service';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(AuthGuard)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get('budget/:budgetId')
  @ApiOperation({ summary: 'Liste toutes les transactions d\'un budget' })
  @ApiParam({
    name: 'budgetId',
    description: 'Identifiant unique du budget',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des transactions récupérée avec succès',
  })
  async findByBudget(
    @Param('budgetId') budgetId: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    return this.transactionService.findByBudget(budgetId, user, supabase);
  }

  @Post()
  @ApiOperation({ summary: 'Crée une nouvelle transaction' })
  @ApiResponse({
    status: 201,
    description: 'Transaction créée avec succès',
  })
  async create(
    @Body(new ZodBodyPipe(transactionCreateSchema)) createTransactionDto: TransactionCreate,
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
  })
  async findOne(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    return this.transactionService.findOne(id, user, supabase);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Met à jour une transaction existante' })
  @ApiParam({
    name: 'id',
    description: 'Identifiant unique de la transaction',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction mise à jour avec succès',
  })
  async update(
    @Param('id') id: string,
    @Body(new ZodBodyPipe(transactionUpdateSchema)) updateTransactionDto: TransactionUpdate,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    return this.transactionService.update(id, updateTransactionDto, user, supabase);
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
  })
  async remove(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ) {
    return this.transactionService.remove(id, user, supabase);
  }
}