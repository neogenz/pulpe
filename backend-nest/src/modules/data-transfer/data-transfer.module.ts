import { Module } from '@nestjs/common';
import { DataTransferController } from './data-transfer.controller';
import { DataTransferService } from './data-transfer.service';

@Module({
  imports: [],
  controllers: [DataTransferController],
  providers: [DataTransferService],
  exports: [DataTransferService],
})
export class DataTransferModule {}
