import { Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { UserController } from './user.controller';

@Module({
  controllers: [UserController],
  providers: [createInfoLoggerProvider(UserController.name)],
})
export class UserModule {}
