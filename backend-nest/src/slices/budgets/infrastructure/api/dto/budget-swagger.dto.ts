import { createZodDto } from '@anatine/zod-nestjs';
import {
  budgetCreateSchema,
  budgetUpdateSchema,
  budgetSchema,
} from '@pulpe/shared';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

// Create Budget DTO
export class BudgetCreateDto extends createZodDto(budgetCreateSchema) {}

// Update Budget DTO
export class BudgetUpdateDto extends createZodDto(budgetUpdateSchema) {}

// Budget Response DTO
export class BudgetResponseDto extends createZodDto(
  z.object({
    success: z.literal(true),
    data: budgetSchema,
  }),
) {}

// Budget List Response DTO
export class BudgetListResponseDto extends createZodDto(
  z.object({
    success: z.literal(true),
    data: z.array(budgetSchema),
  }),
) {}

// Budget Delete Response DTO
export class BudgetDeleteResponseDto extends createZodDto(
  z.object({
    success: z.literal(true),
    message: z.string(),
  }),
) {}

// Budget Details Response DTO (for future use with transactions and budget lines)
export class BudgetDetailsResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({
    description: 'Budget with all related data',
    type: 'object',
    properties: {
      budget: { $ref: '#/components/schemas/Budget' },
      transactions: {
        type: 'array',
        items: { $ref: '#/components/schemas/Transaction' },
      },
      budgetLines: {
        type: 'array',
        items: { $ref: '#/components/schemas/BudgetLine' },
      },
    },
  })
  data!: {
    budget: any /* eslint-disable-line @typescript-eslint/no-explicit-any */;
    transactions: any /* eslint-disable-line @typescript-eslint/no-explicit-any */[];
    budgetLines: any /* eslint-disable-line @typescript-eslint/no-explicit-any */[];
  };
}
