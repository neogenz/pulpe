import { z } from 'zod/v4';
import { VAULT_CODE_LENGTH } from '@core/auth';

export interface SetupVaultCodeSubmit {
  readonly vaultCode: string;
  readonly rememberDevice: boolean;
}

export const setupVaultCodeFormSchema = z
  .object({
    vaultCode: z.string().length(VAULT_CODE_LENGTH).regex(/^\d+$/),
    confirmCode: z.string(),
    rememberDevice: z.boolean(),
  })
  .refine((input) => input.vaultCode === input.confirmCode, {
    message: 'vault codes do not match',
    path: ['confirmCode'],
  })
  .transform(
    (input): SetupVaultCodeSubmit => ({
      vaultCode: input.vaultCode,
      rememberDevice: input.rememberDevice,
    }),
  );

export type SetupVaultCodeFormValue = z.input<typeof setupVaultCodeFormSchema>;
