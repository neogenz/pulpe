import {
  Controller,
  Get,
  Post,
  Put,
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
  type TransactionResponse,
  type TransactionListResponse,
  type TransactionDeleteResponse,
} from '@pulpe/shared';
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
} from './dto/transaction-swagger.dto';
import { ErrorResponseDto } from '@common/dto/response.dto';

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
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
    return this.transactionService.findByBudget(budgetId, user, supabase);
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
}
