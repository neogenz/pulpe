import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { PostHogService } from '@core/analytics/posthog';
import { StorageService, STORAGE_KEYS } from '@core/storage';
import { FirstTransactionTracker } from './first-transaction-tracker';
import { TransactionApi } from './transaction-api';

describe('FirstTransactionTracker', () => {
  let transactionApi: { hasTransaction$: ReturnType<typeof vi.fn> };
  let postHog: { captureEvent: ReturnType<typeof vi.fn> };

  function setup(): FirstTransactionTracker {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: TransactionApi, useValue: transactionApi },
        { provide: PostHogService, useValue: postHog },
      ],
    });
    TestBed.inject(StorageService).remove(
      STORAGE_KEYS.FIRST_TRANSACTION_RECORDED,
    );
    return TestBed.inject(FirstTransactionTracker);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    transactionApi = { hasTransaction$: vi.fn().mockReturnValue(of(false)) };
    postHog = { captureEvent: vi.fn() };
  });

  it('should await a first entry once the server says there is none', async () => {
    const tracker = setup();
    expect(tracker.isAwaitingFirstTransaction()).toBe(false);

    await tracker.load();

    expect(tracker.isAwaitingFirstTransaction()).toBe(true);
  });

  it('should not await when the server holds an entry', async () => {
    transactionApi.hasTransaction$.mockReturnValue(of(true));
    const tracker = setup();

    await tracker.load();

    expect(tracker.isAwaitingFirstTransaction()).toBe(false);
  });

  it('should stay unknown, and hidden, when the server cannot answer', async () => {
    transactionApi.hasTransaction$.mockReturnValue(
      throwError(() => new Error('offline')),
    );
    const tracker = setup();

    await tracker.load();

    expect(tracker.isAwaitingFirstTransaction()).toBe(false);
  });

  it('should mark the first entry, from any surface, exactly once', async () => {
    const tracker = setup();
    await tracker.load();

    tracker.recordCreated('expense', 'budget_details');
    tracker.recordCreated('expense', 'add_button');

    expect(postHog.captureEvent).toHaveBeenCalledTimes(1);
    expect(postHog.captureEvent).toHaveBeenCalledWith(
      'first_transaction_created',
      { type: 'expense', source: 'budget_details' },
    );
    expect(tracker.isAwaitingFirstTransaction()).toBe(false);
  });

  it('should not mark an entry while the answer is unknown', () => {
    const tracker = setup();

    tracker.recordCreated('income', 'reconciliation');

    expect(postHog.captureEvent).not.toHaveBeenCalled();
  });

  it('should keep an entry recorded while the request was out', async () => {
    const answer = new Subject<boolean>();
    transactionApi.hasTransaction$.mockReturnValue(answer);
    const tracker = setup();

    const loading = tracker.load();
    tracker.recordCreated('expense', 'add_button');
    answer.next(false);
    answer.complete();
    await loading;

    expect(tracker.isAwaitingFirstTransaction()).toBe(false);
  });

  // An entry undone right away empties the account again on the server.
  it('should not ask again once this browser recorded an entry', async () => {
    const tracker = setup();
    tracker.recordCreated('expense', 'add_button');
    tracker.reset();
    transactionApi.hasTransaction$.mockClear();

    await tracker.load();

    expect(transactionApi.hasTransaction$).not.toHaveBeenCalled();
    expect(tracker.isAwaitingFirstTransaction()).toBe(false);
  });

  it('should ask again for the next account after a reset', async () => {
    const tracker = setup();
    await tracker.load();
    TestBed.inject(StorageService).remove(
      STORAGE_KEYS.FIRST_TRANSACTION_RECORDED,
    );

    tracker.reset();
    await tracker.load();

    expect(transactionApi.hasTransaction$).toHaveBeenCalledTimes(2);
  });
});
