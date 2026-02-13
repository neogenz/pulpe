import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { z } from 'zod';
import { ApiClient } from './api-client';
import { ApiError } from './api-error';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';

const TEST_BASE_URL = 'http://localhost:3000/api/v1';

const mockConfig = {
  backendApiUrl: vi.fn().mockReturnValue(TEST_BASE_URL),
};

const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

const testSchema = z.object({
  success: z.literal(true),
  data: z.object({ id: z.string(), name: z.string() }),
});

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
      ApiClient,
      { provide: ApplicationConfiguration, useValue: mockConfig },
      { provide: Logger, useValue: mockLogger },
    ],
  });

  return {
    client: TestBed.inject(ApiClient),
    httpTesting: TestBed.inject(HttpTestingController),
  };
}

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get$', () => {
    it('should parse valid response with Zod schema', () => {
      const { client, httpTesting } = setup();
      const response = { success: true, data: { id: '1', name: 'Test' } };
      let result: unknown;

      client.get$('/items/1', testSchema).subscribe((r) => (result = r));

      const req = httpTesting.expectOne(`${TEST_BASE_URL}/items/1`);
      expect(req.request.method).toBe('GET');
      req.flush(response);

      expect(result).toEqual(response);
    });

    it('should throw ApiError with ZOD_PARSE_ERROR on invalid response', () => {
      const { client, httpTesting } = setup();
      let error: unknown;

      client.get$('/items/1', testSchema).subscribe({
        error: (e) => (error = e),
      });

      req(httpTesting, '/items/1').flush({ invalid: 'data' });

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe('ZOD_PARSE_ERROR');
      expect((error as ApiError).status).toBe(0);
    });

    it('should normalize HTTP 404 error with backend payload', () => {
      const { client, httpTesting } = setup();
      let error: unknown;

      client.get$('/items/999', testSchema).subscribe({
        error: (e) => (error = e),
      });

      req(httpTesting, '/items/999').flush(
        { success: false, error: 'Not found', code: 'ERR_NOT_FOUND' },
        { status: 404, statusText: 'Not Found' },
      );

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(404);
      expect((error as ApiError).code).toBe('ERR_NOT_FOUND');
      expect((error as ApiError).message).toBe('Not found');
    });

    it('should handle HTTP 500 with non-standard payload', () => {
      const { client, httpTesting } = setup();
      let error: unknown;

      client.get$('/items/1', testSchema).subscribe({
        error: (e) => (error = e),
      });

      req(httpTesting, '/items/1').flush('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      });

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(500);
    });
  });

  describe('post$', () => {
    it('should send body and parse response', () => {
      const { client, httpTesting } = setup();
      const body = { name: 'New Item' };
      const response = { success: true, data: { id: '2', name: 'New Item' } };
      let result: unknown;

      client.post$('/items', body, testSchema).subscribe((r) => (result = r));

      const request = httpTesting.expectOne(`${TEST_BASE_URL}/items`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual(body);
      request.flush(response);

      expect(result).toEqual(response);
    });
  });

  describe('patch$', () => {
    it('should send PATCH and parse response', () => {
      const { client, httpTesting } = setup();
      const body = { name: 'Updated' };
      const response = { success: true, data: { id: '1', name: 'Updated' } };
      let result: unknown;

      client
        .patch$('/items/1', body, testSchema)
        .subscribe((r) => (result = r));

      const request = httpTesting.expectOne(`${TEST_BASE_URL}/items/1`);
      expect(request.request.method).toBe('PATCH');
      request.flush(response);

      expect(result).toEqual(response);
    });
  });

  describe('put$', () => {
    it('should send PUT and parse response', () => {
      const { client, httpTesting } = setup();
      const body = { name: 'Replaced' };
      const response = { success: true, data: { id: '1', name: 'Replaced' } };
      let result: unknown;

      client.put$('/items/1', body, testSchema).subscribe((r) => (result = r));

      const request = httpTesting.expectOne(`${TEST_BASE_URL}/items/1`);
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual(body);
      request.flush(response);

      expect(result).toEqual(response);
    });
  });

  describe('delete$', () => {
    it('should send DELETE and parse response', () => {
      const { client, httpTesting } = setup();
      const deleteSchema = z.object({
        success: z.literal(true),
        message: z.string(),
      });
      let result: unknown;

      client.delete$('/items/1', deleteSchema).subscribe((r) => (result = r));

      const request = httpTesting.expectOne(`${TEST_BASE_URL}/items/1`);
      expect(request.request.method).toBe('DELETE');
      request.flush({ success: true, message: 'Deleted' });

      expect(result).toEqual({ success: true, message: 'Deleted' });
    });
  });

  describe('deleteVoid$', () => {
    it('should handle 204 no-content response', () => {
      const { client, httpTesting } = setup();
      let completed = false;

      client.deleteVoid$('/items/1').subscribe({
        complete: () => (completed = true),
      });

      const request = httpTesting.expectOne(`${TEST_BASE_URL}/items/1`);
      expect(request.request.method).toBe('DELETE');
      request.flush(null, { status: 204, statusText: 'No Content' });

      expect(completed).toBe(true);
    });

    it('should normalize error on failed void delete', () => {
      const { client, httpTesting } = setup();
      let error: unknown;

      client.deleteVoid$('/items/999').subscribe({
        error: (e) => (error = e),
      });

      req(httpTesting, '/items/999').flush(
        { success: false, error: 'Not found', code: 'ERR_NOT_FOUND' },
        { status: 404, statusText: 'Not Found' },
      );

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(404);
    });
  });

  describe('postVoid$', () => {
    it('should send POST and handle void response', () => {
      const { client, httpTesting } = setup();
      let completed = false;

      client.postVoid$('/items/1/toggle', {}).subscribe({
        complete: () => (completed = true),
      });

      const request = httpTesting.expectOne(`${TEST_BASE_URL}/items/1/toggle`);
      expect(request.request.method).toBe('POST');
      request.flush(null);

      expect(completed).toBe(true);
    });
  });

  describe('error logging', () => {
    it('should log errors via Logger', () => {
      const { client, httpTesting } = setup();

      client.get$('/fail', testSchema).subscribe({ error: vi.fn() });

      req(httpTesting, '/fail').flush(
        { success: false, error: 'Bad request' },
        { status: 400, statusText: 'Bad Request' },
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('[ApiClient]'),
        expect.objectContaining({ status: 400 }),
      );
    });
  });
});

function req(httpTesting: HttpTestingController, path: string) {
  return httpTesting.expectOne(`${TEST_BASE_URL}${path}`);
}
