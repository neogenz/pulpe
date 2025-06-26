import { ApiProperty } from '@nestjs/swagger';

export class BudgetCreateFromOnboardingDto {
  @ApiProperty({
    description: 'Mois du budget (1-12)',
    example: 1,
    minimum: 1,
    maximum: 12,
  })
  month: number;

  @ApiProperty({
    description: 'Année du budget',
    example: 2024,
    minimum: 2020,
    maximum: 2034,
  })
  year: number;

  @ApiProperty({
    description: 'Description du budget',
    example: 'Budget mensuel janvier 2024',
    minLength: 1,
    maxLength: 500,
  })
  description: string;

  @ApiProperty({
    description: 'Revenu mensuel',
    example: 3000,
    minimum: 0,
  })
  monthlyIncome: number;

  @ApiProperty({
    description: 'Coûts de logement',
    example: 1000,
    minimum: 0,
  })
  housingCosts: number;

  @ApiProperty({
    description: 'Assurance santé',
    example: 150,
    minimum: 0,
  })
  healthInsurance: number;

  @ApiProperty({
    description: 'Crédit/Leasing véhicule',
    example: 300,
    minimum: 0,
  })
  leasingCredit: number;

  @ApiProperty({
    description: 'Forfait téléphone',
    example: 50,
    minimum: 0,
  })
  phonePlan: number;

  @ApiProperty({
    description: 'Coûts de transport',
    example: 100,
    minimum: 0,
  })
  transportCosts: number;
}
