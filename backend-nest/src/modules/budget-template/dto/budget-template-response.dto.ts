import { ApiProperty } from "@nestjs/swagger";
import { SuccessResponseDto } from "@common/dto/response.dto";

export class BudgetTemplateDto {
  @ApiProperty({
    description: "Unique budget template identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Template name",
    example: "Budget Étudiant",
  })
  name: string;

  @ApiProperty({
    description: "Template description",
    example: "Template pour un budget étudiant avec revenus limités",
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: "Template category",
    example: "Étudiant",
    nullable: true,
  })
  category: string | null;

  @ApiProperty({
    description: "Whether this template is marked as default",
    example: false,
  })
  isDefault: boolean;

  @ApiProperty({
    description: "User ID who owns this template (null for public templates)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    nullable: true,
  })
  userId: string | null;

  @ApiProperty({
    description: "Template creation timestamp",
    example: "2024-01-15T10:30:00Z",
  })
  createdAt: string;

  @ApiProperty({
    description: "Template last update timestamp",
    example: "2024-01-15T10:30:00Z",
  })
  updatedAt: string;
}

export class BudgetTemplateListResponseDto {
  @ApiProperty({
    description: "Indicates if the request was successful",
    example: true,
  })
  success: true;

  @ApiProperty({
    description: "List of budget templates",
    type: [BudgetTemplateDto],
  })
  data: BudgetTemplateDto[];
}

export class BudgetTemplateResponseDto {
  @ApiProperty({
    description: "Indicates if the request was successful",
    example: true,
  })
  success: true;

  @ApiProperty({
    description: "Budget template data",
    type: BudgetTemplateDto,
  })
  data: BudgetTemplateDto;
}

export class BudgetTemplateDeleteResponseDto {
  @ApiProperty({
    description: "Indicates if the request was successful",
    example: true,
  })
  success: true;

  @ApiProperty({ example: "Template supprimé avec succès" })
  message: string;
}

export class TemplateTransactionDto {
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  createdAt: string;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  updatedAt: string;

  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  templateId: string;

  @ApiProperty({ example: 1000 })
  amount: number;

  @ApiProperty({ example: "expense", enum: ["expense", "income", "saving"] })
  type: "expense" | "income" | "saving";

  @ApiProperty({ example: "fixed", enum: ["fixed", "variable"] })
  expenseType: "fixed" | "variable";

  @ApiProperty({ example: "Loyer" })
  name: string;

  @ApiProperty({ example: "Loyer mensuel", required: false })
  description?: string | null;

  @ApiProperty({ example: true })
  isRecurring: boolean;
}

export class TemplateTransactionListResponseDto extends SuccessResponseDto {
  @ApiProperty({
    type: [TemplateTransactionDto],
    description: "List of template transactions",
  })
  data: TemplateTransactionDto[];
}
