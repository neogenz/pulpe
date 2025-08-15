import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { vi } from 'vitest';
import { ApplicationConfiguration } from './application-configuration';
import type { ApplicationConfig } from './types';

describe('ApplicationConfiguration', () => {
  let service: ApplicationConfiguration;
  let httpMock: HttpTestingController;

  const mockValidConfig: ApplicationConfig = {
    supabase: {
      url: 'http://localhost:54321',
      anonKey: 'mock.anon.key', // Simple mock JWT format (3 parts separated by dots)
    },
    backend: {
      apiUrl: 'http://localhost:3000/api/v1',
    },
    environment: 'local',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ApplicationConfiguration,
        provideZonelessChangeDetection(), // Angular 20 zoneless mode
      ],
    });
    service = TestBed.inject(ApplicationConfiguration);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock?.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('signals initialization', () => {
    it('should have default signal values', () => {
      expect(service.supabaseUrl()).toBe('');
      expect(service.supabaseAnonKey()).toBe('');
      expect(service.backendApiUrl()).toBe('');
      expect(service.environment()).toBe('development');
    });

    it('should compute environment flags correctly', () => {
      service.environment.set('development');
      expect(service.isDevelopment()).toBe(true);
      expect(service.isProduction()).toBe(false);
      expect(service.isLocal()).toBe(false);

      service.environment.set('production');
      expect(service.isDevelopment()).toBe(false);
      expect(service.isProduction()).toBe(true);
      expect(service.isLocal()).toBe(false);

      service.environment.set('local');
      expect(service.isDevelopment()).toBe(false);
      expect(service.isProduction()).toBe(false);
      expect(service.isLocal()).toBe(true);
    });

    it('should compute rawConfiguration correctly', () => {
      // Initially null since configuration is incomplete
      expect(service.rawConfiguration()).toBe(null);

      // Set partial configuration - still null
      service.supabaseUrl.set('http://localhost:54321');
      service.supabaseAnonKey.set('test-key');
      expect(service.rawConfiguration()).toBe(null);

      // Complete configuration - should return full config
      service.backendApiUrl.set('http://localhost:3000/api/v1');
      service.environment.set('local');

      const config = service.rawConfiguration();
      expect(config).toEqual({
        supabase: {
          url: 'http://localhost:54321',
          anonKey: 'test-key',
        },
        backend: {
          apiUrl: 'http://localhost:3000/api/v1',
        },
        environment: 'local',
      });
    });
  });

  describe('initialize', () => {
    it('should load and apply valid configuration', async () => {
      const promise = service.initialize();

      const req = httpMock.expectOne('/config.json');
      expect(req.request.method).toBe('GET');
      req.flush(mockValidConfig);

      await promise;

      expect(service.supabaseUrl()).toBe(mockValidConfig.supabase.url);
      expect(service.supabaseAnonKey()).toBe(mockValidConfig.supabase.anonKey);
      expect(service.backendApiUrl()).toBe(mockValidConfig.backend.apiUrl);
      expect(service.environment()).toBe(mockValidConfig.environment);
    });

    it('should set defaults and throw error on HTTP failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error');

      const promise = service.initialize();

      const req = httpMock.expectOne('/config.json');
      req.error(new ProgressEvent('Network error'));

      await expect(promise).rejects.toThrow();

      expect(service.supabaseUrl()).toBe('http://localhost:54321');
      expect(service.supabaseAnonKey()).toBe('');
      expect(service.backendApiUrl()).toBe('http://localhost:3000/api/v1');
      expect(service.environment()).toBe('development');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should throw error on invalid configuration structure', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const invalidConfig = null;

      const promise = service.initialize();

      const req = httpMock.expectOne('/config.json');
      req.flush(invalidConfig);

      await expect(promise).rejects.toThrow('Configuration validation failed');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should throw error on missing supabase configuration', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const invalidConfig = {
        backend: { apiUrl: 'http://localhost:3000/api/v1' },
        environment: 'local',
      };

      const promise = service.initialize();

      const req = httpMock.expectOne('/config.json');
      req.flush(invalidConfig);

      await expect(promise).rejects.toThrow('Configuration validation failed');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should throw error on missing backend configuration', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const invalidConfig = {
        supabase: { url: 'http://localhost:54321', anonKey: 'mock.anon.key' },
        environment: 'local',
      };

      const promise = service.initialize();

      const req = httpMock.expectOne('/config.json');
      req.flush(invalidConfig);

      await expect(promise).rejects.toThrow('Configuration validation failed');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should throw error on invalid environment', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const invalidConfig = {
        supabase: { url: 'http://localhost:54321', anonKey: 'mock.anon.key' },
        backend: { apiUrl: 'http://localhost:3000/api/v1' },
        environment: 'invalid',
      };

      const promise = service.initialize();

      const req = httpMock.expectOne('/config.json');
      req.flush(invalidConfig);

      await expect(promise).rejects.toThrow('Configuration validation failed');
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('should reload configuration', async () => {
      const promise = service.refresh();

      const req = httpMock.expectOne('/config.json');
      req.flush(mockValidConfig);

      await promise;

      expect(service.supabaseUrl()).toBe(mockValidConfig.supabase.url);
    });
  });
});
