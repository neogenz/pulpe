import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';

@Module({
  controllers: [CurrencyController],
  providers: [CurrencyService, createInfoLoggerProvider(CurrencyService.name)],
  exports: [CurrencyService],
})
export class CurrencyModule {}
