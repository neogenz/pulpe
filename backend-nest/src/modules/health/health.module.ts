import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { MonitoringService } from './monitoring.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [TerminusModule, HttpModule, SupabaseModule],
  controllers: [HealthController],
  providers: [HealthService, MonitoringService],
  exports: [HealthService, MonitoringService],
})
export class HealthModule {}
