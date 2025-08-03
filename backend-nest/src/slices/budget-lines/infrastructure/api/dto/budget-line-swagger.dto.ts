import { createZodDto } from '@anatine/zod-nestjs';
import { ApiProperty } from '@nestjs/swagger';
import {
  budgetLineCreateSchema,
  budgetLineUpdateSchema,
  budgetLineSchema,
  budgetLineResponseSchema,
  budgetLineListResponseSchema,
  budgetLineDeleteResponseSchema,
  BudgetLineCreate,
  BudgetLineUpdate,
  BudgetLine,
} from '@pulpe/shared';

// Request DTOs
export class CreateBudgetLineDto extends createZodDto(budgetLineCreateSchema) {
  @ApiProperty({
    description: 'Budget ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  budgetId!: string;

  @ApiProperty({
    description: 'Template line ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  templateLineId?: string | null;

  @ApiProperty({
    description: 'Savings goal ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  savingsGoalId?: string | null;

  @ApiProperty({ description: 'Budget line name', example: 'Rent' })
  name!: string;

  @ApiProperty({ description: 'Amount', example: 1500.0 })
  amount!: number;

  @ApiProperty({
    description: 'Kind of budget line',
    enum: ['fixed', 'envelope', 'goal'],
    example: 'fixed',
  })
  kind!: 'fixed' | 'envelope' | 'goal';

  @ApiProperty({
    description: 'Recurrence',
    enum: ['monthly', 'yearly', 'one-time'],
    example: 'monthly',
  })
  recurrence!: 'monthly' | 'yearly' | 'one-time';

  @ApiProperty({
    description: 'Is manually adjusted',
    example: false,
    default: false,
  })
  isManuallyAdjusted?: boolean;
}

export class UpdateBudgetLineDto extends createZodDto(budgetLineUpdateSchema) {
  @ApiProperty({
    description: 'Template line ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  templateLineId?: string | null;

  @ApiProperty({
    description: 'Savings goal ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  savingsGoalId?: string | null;

  @ApiProperty({
    description: 'Budget line name',
    example: 'Rent',
    required: false,
  })
  name?: string;

  @ApiProperty({ description: 'Amount', example: 1500.0, required: false })
  amount?: number;

  @ApiProperty({
    description: 'Kind of budget line',
    enum: ['fixed', 'envelope', 'goal'],
    example: 'fixed',
    required: false,
  })
  kind?: 'fixed' | 'envelope' | 'goal';

  @ApiProperty({
    description: 'Recurrence',
    enum: ['monthly', 'yearly', 'one-time'],
    example: 'monthly',
    required: false,
  })
  recurrence?: 'monthly' | 'yearly' | 'one-time';

  @ApiProperty({
    description: 'Is manually adjusted',
    example: false,
    required: false,
  })
  isManuallyAdjusted?: boolean;
}

export class BulkCreateBudgetLineDto {
  @ApiProperty({
    description: 'Array of budget lines to create',
    type: [CreateBudgetLineDto],
    example: [
      {
        budgetId: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Rent',
        amount: 1500,
        kind: 'fixed',
        recurrence: 'monthly',
      },
    ],
  })
  budgetLines!: CreateBudgetLineDto[];
}

// Response DTOs
export class BudgetLineDto extends createZodDto(budgetLineSchema) {
  @ApiProperty({
    description: 'Budget line ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Budget ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  budgetId!: string;

  @ApiProperty({
    description: 'Template line ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  templateLineId!: string | null;

  @ApiProperty({
    description: 'Savings goal ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  savingsGoalId!: string | null;

  @ApiProperty({ description: 'Budget line name', example: 'Rent' })
  name!: string;

  @ApiProperty({ description: 'Amount', example: 1500.0 })
  amount!: number;

  @ApiProperty({
    description: 'Kind of budget line',
    enum: ['fixed', 'envelope', 'goal'],
    example: 'fixed',
  })
  kind!: 'fixed' | 'envelope' | 'goal';

  @ApiProperty({
    description: 'Recurrence',
    enum: ['monthly', 'yearly', 'one-time'],
    example: 'monthly',
  })
  recurrence!: 'monthly' | 'yearly' | 'one-time';

  @ApiProperty({ description: 'Is manually adjusted', example: false })
  isManuallyAdjusted!: boolean;

  @ApiProperty({
    description: 'Creation date',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update date',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt!: string;
}

export class BudgetLineResponseDto extends createZodDto(
  budgetLineResponseSchema,
) {
  @ApiProperty({ description: 'Success indicator', example: true })
  success!: true;

  @ApiProperty({ description: 'Budget line data', type: BudgetLineDto })
  data!: BudgetLine;
}

export class BudgetLineListResponseDto extends createZodDto(
  budgetLineListResponseSchema,
) {
  @ApiProperty({ description: 'Success indicator', example: true })
  success!: true;

  @ApiProperty({ description: 'List of budget lines', type: [BudgetLineDto] })
  data!: BudgetLine[];
}

export class BudgetLineDeleteResponseDto extends createZodDto(
  budgetLineDeleteResponseSchema,
) {
  @ApiProperty({ description: 'Success indicator', example: true })
  success!: true;

  @ApiProperty({
    description: 'Success message',
    example: 'Budget line deleted successfully',
  })
  message!: string;
}
