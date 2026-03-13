import { createZodDto } from 'nestjs-zod';
import {
  encryptionValidateKeyRequestSchema,
  encryptionRecoverRequestSchema,
  encryptionChangePinRequestSchema,
  encryptionVaultStatusResponseSchema,
  encryptionSaltResponseSchema,
  encryptionSetupRecoveryResponseSchema,
  encryptionRecoverResponseSchema,
  encryptionChangePinResponseSchema,
} from 'pulpe-shared';

// Request DTOs
export class EncryptionValidateKeyRequestDto extends createZodDto(
  encryptionValidateKeyRequestSchema,
) {}
export class EncryptionRecoverRequestDto extends createZodDto(
  encryptionRecoverRequestSchema,
) {}
export class EncryptionChangePinRequestDto extends createZodDto(
  encryptionChangePinRequestSchema,
) {}

// Response DTOs
export class EncryptionVaultStatusResponseDto extends createZodDto(
  encryptionVaultStatusResponseSchema,
) {}
export class EncryptionSaltResponseDto extends createZodDto(
  encryptionSaltResponseSchema,
) {}
export class EncryptionSetupRecoveryResponseDto extends createZodDto(
  encryptionSetupRecoveryResponseSchema,
) {}
export class EncryptionRecoverResponseDto extends createZodDto(
  encryptionRecoverResponseSchema,
) {}
export class EncryptionChangePinResponseDto extends createZodDto(
  encryptionChangePinResponseSchema,
) {}
