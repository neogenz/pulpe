import { Module } from '@nestjs/common';
import { DevOnlyGuard } from '../../common/guards/dev-only.guard';
import { BudgetModule } from '../budget/budget.module';
import { BudgetTemplateModule } from '../budget-template/budget-template.module';
import { DemoCleanupService } from './demo-cleanup.service';
import { DemoDataGeneratorService } from './demo-data-generator.service';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [BudgetTemplateModule, BudgetModule],
  controllers: [DemoController],
  providers: [
    DemoService,
    DemoDataGeneratorService,
    DemoCleanupService,
    DevOnlyGuard,
  ],
  exports: [DemoService, DemoCleanupService],
})
export class DemoModule {}
