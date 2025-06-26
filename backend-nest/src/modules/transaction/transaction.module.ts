import { Module } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { TransactionMapper } from './transaction.mapper';

@Module({
  controllers: [TransactionController],
  providers: [TransactionService, TransactionMapper],
})
export class TransactionModule {}
