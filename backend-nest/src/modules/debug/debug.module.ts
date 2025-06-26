import { Module } from '@nestjs/common';
import { DebugController } from './debug.controller';
import { AppLoggerService } from '@common/logger/app-logger.service';

@Module({
  controllers: [DebugController],
  providers: [AppLoggerService],
})
export class DebugModule {}
