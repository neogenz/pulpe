import { Module } from '@nestjs/common';
import { WhatsNewController } from './whats-new.controller';

@Module({
  controllers: [WhatsNewController],
})
export class WhatsNewModule {}
