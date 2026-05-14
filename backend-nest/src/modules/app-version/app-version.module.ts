import { Module } from '@nestjs/common';
import { AppVersionController } from './app-version.controller';

@Module({
  controllers: [AppVersionController],
})
export class AppVersionModule {}
