import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom, of } from 'rxjs';
import { EncryptionApi } from './encryption-api';
import { ApiClient } from '@core/api/api-client';
import {
  encryptionSaltResponseSchema,
  encryptionRekeyResponseSchema,
  encryptionSetupRecoveryResponseSchema,
  encryptionRecoverResponseSchema,
} from 'pulpe-shared';

describe('EncryptionApi', () => {
  let service: EncryptionApi;

  const mockApi = {
    get$: vi.fn(),
    post$: vi.fn(),
    postVoid$: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        EncryptionApi,
        { provide: ApiClient, useValue: mockApi },
      ],
    });

    service = TestBed.inject(EncryptionApi);
  });

  describe('getSalt$()', () => {
    it('should call api.get$ with correct path and schema', async () => {
      const response = {
        salt: 'hex-encoded-salt',
        kdfIterations: 600000,
        hasRecoveryKey: false,
      };
      mockApi.get$.mockReturnValue(of(response));

      const result = await firstValueFrom(service.getSalt$());

      expect(mockApi.get$).toHaveBeenCalledWith(
        '/encryption/salt',
        encryptionSaltResponseSchema,
      );
      expect(result).toEqual(response);
    });
  });

  describe('validateKey$()', () => {
    it('should call api.postVoid$ with correct path and body', async () => {
      mockApi.postVoid$.mockReturnValue(of(undefined));

      await firstValueFrom(service.validateKey$('client-key-hex'));

      expect(mockApi.postVoid$).toHaveBeenCalledWith(
        '/encryption/validate-key',
        { clientKey: 'client-key-hex' },
      );
    });
  });

  describe('rekeyEncryption$()', () => {
    it('should call api.post$ with correct path, body and schema', async () => {
      const response = { success: true as const };
      mockApi.post$.mockReturnValue(of(response));

      const result = await firstValueFrom(
        service.rekeyEncryption$('new-key-hex'),
      );

      expect(mockApi.post$).toHaveBeenCalledWith(
        '/encryption/rekey',
        { newClientKey: 'new-key-hex' },
        encryptionRekeyResponseSchema,
      );
      expect(result.success).toBe(true);
    });
  });

  describe('setupRecoveryKey$()', () => {
    it('should call api.post$ with correct path and schema', async () => {
      const response = { recoveryKey: 'ABCD-EFGH-IJKL-MNOP' };
      mockApi.post$.mockReturnValue(of(response));

      const result = await firstValueFrom(service.setupRecoveryKey$());

      expect(mockApi.post$).toHaveBeenCalledWith(
        '/encryption/setup-recovery',
        {},
        encryptionSetupRecoveryResponseSchema,
      );
      expect(result.recoveryKey).toBe('ABCD-EFGH-IJKL-MNOP');
    });
  });

  describe('recover$()', () => {
    it('should call api.post$ with correct path, body and schema', async () => {
      const response = { success: true as const };
      mockApi.post$.mockReturnValue(of(response));

      const result = await firstValueFrom(
        service.recover$('ABCD-EFGH-IJKL-MNOP', 'new-key-hex'),
      );

      expect(mockApi.post$).toHaveBeenCalledWith(
        '/encryption/recover',
        { recoveryKey: 'ABCD-EFGH-IJKL-MNOP', newClientKey: 'new-key-hex' },
        encryptionRecoverResponseSchema,
      );
      expect(result.success).toBe(true);
    });
  });
});
