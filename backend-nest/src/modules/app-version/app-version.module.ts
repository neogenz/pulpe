import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { AppVersionController } from './app-version.controller';
import { IosVersionGateService } from './ios-version-gate.service';

@Module({
  controllers: [AppVersionController],
  providers: [
    IosVersionGateService,
    createInfoLoggerProvider(IosVersionGateService.name),
  ],
})
export class AppVersionModule {}
