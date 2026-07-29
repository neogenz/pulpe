import { SetMetadata } from '@nestjs/common';

export const ALLOW_VAULT_BOOTSTRAP = 'allowVaultBootstrap';
export const AllowVaultBootstrap = () =>
  SetMetadata(ALLOW_VAULT_BOOTSTRAP, true);
