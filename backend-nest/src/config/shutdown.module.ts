import { Global, Module } from '@nestjs/common';
import { ShutdownService } from './shutdown.config';

@Global()
@Module({
  providers: [ShutdownService],
  exports: [ShutdownService],
})
export class ShutdownModule {}
