import { ApiProperty } from "@nestjs/swagger";

export class BudgetDto {
  @ApiProperty({
    description: "Unique budget identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Budget title",
    example: "Monthly Budget January 2024",
  })
  title: string;

  @ApiProperty({
    description: "Budget year",
    example: 2024,
  })
  year: number;

  @ApiProperty({
    description: "Budget month (1-12)",
    example: 1,
  })
  month: number;

  @ApiProperty({
    description: "Total budget amount",
    example: 2500.0,
  })
  total_amount: number;

  @ApiProperty({
    description: "User ID who owns this budget",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  user_id: string;

  @ApiProperty({
    description: "Budget creation timestamp",
    example: "2024-01-15T10:30:00Z",
  })
  created_at: string;

  @ApiProperty({
    description: "Budget last update timestamp",
    example: "2024-01-15T10:30:00Z",
  })
  updated_at: string;
}

export class BudgetListResponseDto {
  @ApiProperty({
    description: "Indicates if the request was successful",
    example: true,
  })
  success: true;

  @ApiProperty({
    description: "List of budgets",
    type: [BudgetDto],
  })
  data: BudgetDto[];
}

export class BudgetResponseDto {
  @ApiProperty({
    description: "Indicates if the request was successful",
    example: true,
  })
  success: true;

  @ApiProperty({
    description: "Budget data",
    type: BudgetDto,
  })
  data: BudgetDto;
}

export class BudgetDeleteResponseDto {
  @ApiProperty({
    description: "Indicates if the request was successful",
    example: true,
  })
  success: true;

  @ApiProperty({
    description: "Deletion confirmation message",
    example: "Budget supprimé avec succès",
  })
  message: string;
}
