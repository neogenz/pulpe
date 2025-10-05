import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';
import { DemoDataGeneratorService } from './demo-data-generator.service';
import { DemoCleanupService } from './demo-cleanup.service';
import { BudgetTemplateModule } from '../budget-template/budget-template.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BudgetTemplateModule, // For template creation
  ],
  controllers: [DemoController],
  providers: [DemoService, DemoDataGeneratorService, DemoCleanupService],
  exports: [DemoService, DemoCleanupService],
})
export class DemoModule {}
