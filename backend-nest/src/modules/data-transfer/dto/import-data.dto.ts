import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum ImportMode {
  REPLACE = 'replace', // Delete existing data and import new
  MERGE = 'merge', // Keep existing and add new (skip duplicates)
  APPEND = 'append', // Add all as new (may create duplicates)
}

export class ImportOptionsDto {
  @ApiProperty({
    enum: ImportMode,
    default: ImportMode.REPLACE,
    description: 'How to handle existing data during import',
  })
  @IsEnum(ImportMode)
  @IsOptional()
  mode: ImportMode = ImportMode.REPLACE;

  @ApiProperty({
    default: false,
    description: 'If true, perform a dry run without actually importing',
  })
  @IsOptional()
  dryRun?: boolean = false;
}

export class ImportResultDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  imported!: {
    templates: number;
    template_lines: number;
    monthly_budgets: number;
    budget_lines: number;
    transactions: number;
    savings_goals: number;
  };

  @ApiProperty({ required: false })
  errors?: string[];

  @ApiProperty({ required: false })
  warnings?: string[];
}
