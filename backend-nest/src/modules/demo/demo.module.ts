import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';
import { DemoDataGeneratorService } from './demo-data-generator.service';
import { DemoCleanupService } from './demo-cleanup.service';
import { BudgetTemplateModule } from '../budget-template/budget-template.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Rate limiting: 10 requests per hour per IP for demo endpoint
    ThrottlerModule.forRoot([
      {
        name: 'demo',
        ttl: 3600000, // 1 hour in milliseconds
        limit: 10,
      },
    ]),
    BudgetTemplateModule, // For template creation
  ],
  controllers: [DemoController],
  providers: [DemoService, DemoDataGeneratorService, DemoCleanupService],
  exports: [DemoService],
})
export class DemoModule {}
