import { ApiProperty } from '@nestjs/swagger';

export class BudgetTemplateDto {
  @ApiProperty({
    description: 'Unique budget template identifier',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  id: string;

  @ApiProperty({
    description: 'Template name',
    example: 'Budget Étudiant'
  })
  name: string;

  @ApiProperty({
    description: 'Template description',
    example: 'Template pour un budget étudiant avec revenus limités',
    nullable: true
  })
  description: string | null;

  @ApiProperty({
    description: 'Template category',
    example: 'Étudiant',
    nullable: true
  })
  category: string | null;

  @ApiProperty({
    description: 'Whether this template is marked as default',
    example: false
  })
  isDefault: boolean;

  @ApiProperty({
    description: 'User ID who owns this template (null for public templates)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true
  })
  userId: string | null;

  @ApiProperty({
    description: 'Template creation timestamp',
    example: '2024-01-15T10:30:00Z'
  })
  createdAt: string;

  @ApiProperty({
    description: 'Template last update timestamp',
    example: '2024-01-15T10:30:00Z'
  })
  updatedAt: string;
}

export class BudgetTemplateListResponseDto {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true
  })
  success: true;

  @ApiProperty({
    description: 'List of budget templates',
    type: [BudgetTemplateDto]
  })
  data: BudgetTemplateDto[];
}

export class BudgetTemplateResponseDto {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true
  })
  success: true;

  @ApiProperty({
    description: 'Budget template data',
    type: BudgetTemplateDto
  })
  data: BudgetTemplateDto;
}

export class BudgetTemplateDeleteResponseDto {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true
  })
  success: true;

  @ApiProperty({
    description: 'Deletion confirmation message',
    example: 'Template supprimé avec succès'
  })
  message: string;
}