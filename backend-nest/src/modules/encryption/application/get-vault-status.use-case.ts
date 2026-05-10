import { Inject, Injectable } from '@nestjs/common';
import {
  ENCRYPTION_KEY_REPOSITORY,
  type EncryptionKeyRepositoryPort,
} from '../domain/ports/encryption-key-repository.port';
import type { VaultStatus } from '../domain/encryption.entity';

@Injectable()
export class GetVaultStatusUseCase {
  constructor(
    @Inject(ENCRYPTION_KEY_REPOSITORY)
    private readonly repository: EncryptionKeyRepositoryPort,
  ) {}

  execute(userId: string): Promise<VaultStatus> {
    return this.repository.getVaultStatus(userId);
  }
}
