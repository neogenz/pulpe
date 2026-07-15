import { Module } from '@nestjs/common';
import { GetIosWhatsNewUseCase } from './application/get-ios-whats-new.use-case';
import { WhatsNewController } from './infrastructure/http/whats-new.controller';

@Module({
  controllers: [WhatsNewController],
  providers: [GetIosWhatsNewUseCase],
})
export class WhatsNewModule {}
