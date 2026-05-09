import { Global, Module } from '@nestjs/common';
import { createInfoLoggerProvider } from '@common/logger';
import { EncryptionController } from './infrastructure/http/encryption.controller';
import { AesGcmCryptoService } from './infrastructure/crypto/aes-gcm.crypto-service';
import { SupabaseEncryptionKeyRepository } from './infrastructure/persistence/supabase-encryption-key.repository';
import { ENCRYPTION_PORT } from './domain/ports/encryption.port';
import { ENCRYPTION_KEY_REPOSITORY } from './domain/ports/encryption-key-repository.port';
import { GetVaultStatusUseCase } from './application/get-vault-status.use-case';
import { GetUserSaltUseCase } from './application/get-user-salt.use-case';
import { ValidateUserKeyUseCase } from './application/validate-user-key.use-case';
import { SetupRecoveryKeyUseCase } from './application/setup-recovery-key.use-case';
import { RegenerateRecoveryKeyUseCase } from './application/regenerate-recovery-key.use-case';
import { VerifyRecoveryKeyUseCase } from './application/verify-recovery-key.use-case';
import { RecoverWithRecoveryKeyUseCase } from './application/recover-with-recovery-key.use-case';
import { ChangePinUseCase } from './application/change-pin.use-case';

@Global()
@Module({
  controllers: [EncryptionController],
  providers: [
    AesGcmCryptoService,
    SupabaseEncryptionKeyRepository,
    GetVaultStatusUseCase,
    GetUserSaltUseCase,
    ValidateUserKeyUseCase,
    SetupRecoveryKeyUseCase,
    RegenerateRecoveryKeyUseCase,
    VerifyRecoveryKeyUseCase,
    RecoverWithRecoveryKeyUseCase,
    ChangePinUseCase,
    { provide: ENCRYPTION_PORT, useExisting: AesGcmCryptoService },
    {
      provide: ENCRYPTION_KEY_REPOSITORY,
      useExisting: SupabaseEncryptionKeyRepository,
    },
    createInfoLoggerProvider(AesGcmCryptoService.name),
    createInfoLoggerProvider(ValidateUserKeyUseCase.name),
    createInfoLoggerProvider(SetupRecoveryKeyUseCase.name),
    createInfoLoggerProvider(RegenerateRecoveryKeyUseCase.name),
    createInfoLoggerProvider(RecoverWithRecoveryKeyUseCase.name),
    createInfoLoggerProvider(ChangePinUseCase.name),
  ],
  exports: [ENCRYPTION_PORT],
})
export class EncryptionModule {}
