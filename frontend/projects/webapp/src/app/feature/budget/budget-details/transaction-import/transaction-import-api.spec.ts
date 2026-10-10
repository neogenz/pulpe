import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '@core/api/api-client';
import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionImportApi } from './transaction-import-api';

const BUDGET_ID = '00000000-0000-4000-8000-000000000025';
const LINE_ID = '00000000-0000-4000-8000-0000000000a1';

describe('TransactionImportApi', () => {
  let api: TransactionImportApi;
  let postFormData$: ReturnType<typeof vi.fn>;
  const file = new File(['<Document/>'], 'releve.xml', { type: 'text/xml' });

  beforeEach(() => {
    postFormData$ = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        TransactionImportApi,
        { provide: ApiClient, useValue: { postFormData$ } },
      ],
    });
    api = TestBed.inject(TransactionImportApi);
  });

  function sentBody(): FormData {
    return postFormData$.mock.calls[0][1] as FormData;
  }

  it('should send the budget and the file, without decisions, for the preview', async () => {
    postFormData$.mockReturnValue(of({ success: true, data: {} }));

    await firstValueFrom(api.preview$(BUDGET_ID, file));

    expect(postFormData$.mock.calls[0][0]).toBe('/transaction-imports/preview');
    expect(sentBody().get('budgetId')).toBe(BUDGET_ID);
    expect(sentBody().get('file')).toBeInstanceOf(File);
    expect(sentBody().has('decisions')).toBe(false);
  });

  it('should send the decisions as one JSON text field on confirmation', async () => {
    postFormData$.mockReturnValue(of({ success: true, data: {} }));
    const decisions = [{ position: 2, budgetLineId: LINE_ID }];

    await firstValueFrom(api.import$(BUDGET_ID, file, decisions));

    expect(postFormData$.mock.calls[0][0]).toBe('/transaction-imports');
    expect(sentBody().get('budgetId')).toBe(BUDGET_ID);
    expect(sentBody().getAll('decisions')).toEqual([JSON.stringify(decisions)]);
    expect(sentBody().get('file')).toBeInstanceOf(File);
  });

  it('should send an empty decisions array when nothing is attached', async () => {
    postFormData$.mockReturnValue(of({ success: true, data: {} }));

    await firstValueFrom(api.import$(BUDGET_ID, file, []));

    expect(sentBody().get('decisions')).toBe('[]');
  });

  it('should refuse a payload attaching the same operation twice before sending', async () => {
    const decisions = [
      { position: 2, budgetLineId: LINE_ID },
      { position: 2, budgetLineId: LINE_ID },
    ];

    await expect(
      firstValueFrom(api.import$(BUDGET_ID, file, decisions)),
    ).rejects.toThrow();
    expect(postFormData$).not.toHaveBeenCalled();
  });
});
