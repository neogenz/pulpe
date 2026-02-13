import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import { TemplateApi } from './template-api';
import { ApiClient } from '../api/api-client';

describe('TemplateApi', () => {
  let service: TemplateApi;
  let mockApi: { get$: Mock };

  const mockTemplate = {
    id: 'tpl-1',
    name: 'Standard',
    isDefault: true,
    description: 'test',
  };

  const mockTemplateLine = {
    id: 'line-1',
    templateId: 'tpl-1',
    label: 'Loyer',
    amount: 1200,
    type: 'expense',
    category: 'fixed',
  };

  beforeEach(() => {
    mockApi = {
      get$: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        TemplateApi,
        { provide: ApiClient, useValue: mockApi },
      ],
    });

    service = TestBed.inject(TemplateApi);
  });

  describe('getAll$()', () => {
    it('should call ApiClient.get$ with correct path', async () => {
      mockApi.get$.mockReturnValue(of({ success: true, data: [mockTemplate] }));

      await firstValueFrom(service.getAll$());

      expect(mockApi.get$).toHaveBeenCalledWith(
        '/budget-templates',
        expect.anything(),
      );
    });

    it('should map response.data', async () => {
      mockApi.get$.mockReturnValue(of({ success: true, data: [mockTemplate] }));

      const result = await firstValueFrom(service.getAll$());

      expect(result).toEqual([mockTemplate]);
    });

    it('should return empty array when no templates exist', async () => {
      mockApi.get$.mockReturnValue(of({ success: true, data: [] }));

      const result = await firstValueFrom(service.getAll$());

      expect(result).toEqual([]);
    });

    it('should propagate errors from ApiClient', async () => {
      const error = new Error('API error');
      mockApi.get$.mockReturnValue(throwError(() => error));

      await expect(firstValueFrom(service.getAll$())).rejects.toThrow(
        'API error',
      );
    });
  });

  describe('getById$(id)', () => {
    it('should call ApiClient.get$ with correct path including id', async () => {
      mockApi.get$.mockReturnValue(of({ success: true, data: mockTemplate }));

      await firstValueFrom(service.getById$('tpl-123'));

      expect(mockApi.get$).toHaveBeenCalledWith(
        '/budget-templates/tpl-123',
        expect.anything(),
      );
    });

    it('should map response.data', async () => {
      mockApi.get$.mockReturnValue(of({ success: true, data: mockTemplate }));

      const result = await firstValueFrom(service.getById$('tpl-1'));

      expect(result).toEqual(mockTemplate);
    });

    it('should propagate errors from ApiClient', async () => {
      const error = new Error('Template not found');
      mockApi.get$.mockReturnValue(throwError(() => error));

      await expect(
        firstValueFrom(service.getById$('tpl-invalid')),
      ).rejects.toThrow('Template not found');
    });
  });

  describe('getTemplateLines$(templateId)', () => {
    it('should call ApiClient.get$ with correct path including templateId', async () => {
      mockApi.get$.mockReturnValue(of({ success: true, data: [] }));

      await firstValueFrom(service.getTemplateLines$('tpl-123'));

      expect(mockApi.get$).toHaveBeenCalledWith(
        '/budget-templates/tpl-123/lines',
        expect.anything(),
      );
    });

    it('should map response.data', async () => {
      mockApi.get$.mockReturnValue(
        of({ success: true, data: [mockTemplateLine] }),
      );

      const result = await firstValueFrom(service.getTemplateLines$('tpl-1'));

      expect(result).toEqual([mockTemplateLine]);
    });

    it('should return empty array when no lines exist', async () => {
      mockApi.get$.mockReturnValue(of({ success: true, data: [] }));

      const result = await firstValueFrom(service.getTemplateLines$('tpl-1'));

      expect(result).toEqual([]);
    });

    it('should propagate errors from ApiClient', async () => {
      const error = new Error('Failed to fetch template lines');
      mockApi.get$.mockReturnValue(throwError(() => error));

      await expect(
        firstValueFrom(service.getTemplateLines$('tpl-invalid')),
      ).rejects.toThrow('Failed to fetch template lines');
    });
  });
});
