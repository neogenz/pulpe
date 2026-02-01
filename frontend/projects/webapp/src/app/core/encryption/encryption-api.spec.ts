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
    backendApiUrl: () => 'http://localhost:3000/api',
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

    it('should include a temporary X-Client-Key header', () => {
      service.getSalt$().subscribe();

      const req = httpTesting.expectOne(
        'http://localhost:3000/api/v1/encryption/salt',
      );
      expect(req.request.headers.has('X-Client-Key')).toBe(true);
      expect(req.request.headers.get('X-Client-Key')).toBe(
        '0'.repeat(63) + '1',
      );
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
});
