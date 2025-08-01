import { Module } from '@nestjs/common';
import { BudgetTemplateController } from './budget-template.controller';
import { BudgetTemplateService } from './budget-template.service';
import { BudgetTemplateMapper } from './budget-template.mapper';
import { TemplateValidationService } from './services/template-validation.service';
import { TemplateLineService } from './services/template-line.service';
import { LoggingService } from '@common/services/logging.service';

@Module({
  controllers: [BudgetTemplateController],
  providers: [
    BudgetTemplateService,
    BudgetTemplateMapper,
    TemplateValidationService,
    TemplateLineService,
    LoggingService,
  ],
})
export class BudgetTemplateModule {}
