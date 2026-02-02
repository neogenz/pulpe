import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { EncryptionApi } from './encryption-api';
import { ApplicationConfiguration } from '@core/config/application-configuration';

describe('EncryptionApi', () => {
  let service: EncryptionApi;
  let httpTesting: HttpTestingController;

  const mockApplicationConfig = {
    backendApiUrl: () => 'http://localhost:3000/api/v1',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        EncryptionApi,
        {
          provide: ApplicationConfiguration,
          useValue: mockApplicationConfig,
        },
      ],
    });

    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(EncryptionApi);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  describe('getSalt$()', () => {
    it('should call GET /v1/encryption/salt', () => {
      service.getSalt$().subscribe();

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/encryption/salt',
      );
      expect(req.request.method).toBe('GET');
    });

    it('should return salt and kdfIterations', () => {
      const expectedResponse = {
        salt: 'base64-encoded-salt',
        kdfIterations: 100000,
      };

      service.getSalt$().subscribe((response) => {
        expect(response.salt).toBe('base64-encoded-salt');
        expect(response.kdfIterations).toBe(100000);
      });

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/encryption/salt',
      );
      req.flush(expectedResponse);
    });
  });

  describe('notifyPasswordChange$()', () => {
    it('should call POST /v1/encryption/password-change with newClientKey body', () => {
      const newClientKeyHex = 'new-client-key-hex';

      service.notifyPasswordChange$(newClientKeyHex).subscribe();

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/encryption/password-change',
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ newClientKey: newClientKeyHex });
    });

    it('should return success response', () => {
      const newClientKeyHex = 'new-client-key-hex';
      const expectedResponse = { success: true };

      service.notifyPasswordChange$(newClientKeyHex).subscribe((response) => {
        expect(response.success).toBe(true);
      });

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/encryption/password-change',
      );
      req.flush(expectedResponse);
    });
  });

  describe('setupRecoveryKey$()', () => {
    it('should POST to /encryption/setup-recovery with empty body', () => {
      service.setupRecoveryKey$().subscribe();

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/encryption/setup-recovery',
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
    });

    it('should return recoveryKey on success', () => {
      const expectedResponse = { recoveryKey: 'ABCD-EFGH-1234-5678' };

      service.setupRecoveryKey$().subscribe((response) => {
        expect(response.recoveryKey).toBe('ABCD-EFGH-1234-5678');
      });

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/encryption/setup-recovery',
      );
      req.flush(expectedResponse);
    });
  });

  describe('validateKey$()', () => {
    it('should POST to /encryption/validate-key with clientKey body', () => {
      service.validateKey$('client-key-hex').subscribe();

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/encryption/validate-key',
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ clientKey: 'client-key-hex' });
    });

    it('should complete without error on 204', () => {
      let completed = false;

      service.validateKey$('client-key-hex').subscribe({
        complete: () => (completed = true),
      });

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/encryption/validate-key',
      );
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(completed).toBe(true);
    });
  });

  describe('recover$()', () => {
    it('should POST to /encryption/recover with recoveryKey and newClientKey', () => {
      service.recover$('ABCD-EFGH-1234-5678', 'new-key-hex').subscribe();

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/encryption/recover',
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        recoveryKey: 'ABCD-EFGH-1234-5678',
        newClientKey: 'new-key-hex',
      });
    });

    it('should return success response', () => {
      const expectedResponse = { success: true };

      service
        .recover$('ABCD-EFGH-1234-5678', 'new-key-hex')
        .subscribe((response) => {
          expect(response.success).toBe(true);
        });

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/encryption/recover',
      );
      req.flush(expectedResponse);
    });
  });
});
