import { Module } from '@nestjs/common';
import { GetWhatsNewUseCase } from './application/get-whats-new.use-case';
import { WhatsNewController } from './infrastructure/http/whats-new.controller';

@Module({
  controllers: [WhatsNewController],
  providers: [GetWhatsNewUseCase],
})
export class WhatsNewModule {}
