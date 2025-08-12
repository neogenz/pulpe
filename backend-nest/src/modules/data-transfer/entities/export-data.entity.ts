import { ApiProperty } from '@nestjs/swagger';

export class SavingsGoal {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  target_amount!: number;

  @ApiProperty()
  target_date!: string;

  @ApiProperty({ enum: ['HIGH', 'MEDIUM', 'LOW'] })
  priority!: 'HIGH' | 'MEDIUM' | 'LOW';

  @ApiProperty({ enum: ['ACTIVE', 'COMPLETED', 'PAUSED'] })
  status!: 'ACTIVE' | 'COMPLETED' | 'PAUSED';

  @ApiProperty()
  user_id!: string;

  @ApiProperty()
  created_at!: string;

  @ApiProperty()
  updated_at!: string;
}

export class ExportDataContent {
  @ApiProperty({ type: [Object] })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  templates!: any[];

  @ApiProperty({ type: [Object] })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  template_lines!: any[];

  @ApiProperty({ type: [Object] })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  monthly_budgets!: any[];

  @ApiProperty({ type: [Object] })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  budget_lines!: any[];

  @ApiProperty({ type: [Object] })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transactions!: any[];

  @ApiProperty({ type: [SavingsGoal], isArray: true })
  savings_goals!: SavingsGoal[];
}

export class ExportMetadata {
  @ApiProperty()
  total_templates!: number;

  @ApiProperty()
  total_budgets!: number;

  @ApiProperty()
  total_transactions!: number;

  @ApiProperty()
  total_savings_goals!: number;

  @ApiProperty()
  date_range!: {
    oldest_budget: string | null;
    newest_budget: string | null;
  };
}

export class ExportData {
  @ApiProperty({ example: '1.0.0' })
  version!: string;

  @ApiProperty()
  exported_at!: string;

  @ApiProperty()
  user_id!: string;

  @ApiProperty({ type: ExportDataContent })
  data!: ExportDataContent;

  @ApiProperty({ type: ExportMetadata })
  metadata!: ExportMetadata;
}
