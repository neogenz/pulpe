import { BreakpointObserver } from '@angular/cdk/layout';
import {
  Component,
  createEnvironmentInjector,
  DestroyRef,
  EnvironmentInjector,
  provideZonelessChangeDetection,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ReconcileSheet } from './reconcile-sheet';

@Component({ template: '' })
class Body {}

describe('ReconcileSheet', () => {
  it.each([
    { frame: 'bottom sheet', isHandset: true },
    { frame: 'dialog', isHandset: false },
  ])(
    'should close its own $frame when the step that opened it goes',
    async ({ isHandset }) => {
      const closed = new Subject<string | undefined>();
      const finish = () => {
        closed.next(undefined);
        closed.complete();
      };
      const ref = {
        afterDismissed: () => closed,
        afterClosed: () => closed,
        dismiss: vi.fn(finish),
        close: vi.fn(finish),
      };
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: MatBottomSheet, useValue: { open: () => ref } },
          { provide: MatDialog, useValue: { open: () => ref } },
          {
            provide: BreakpointObserver,
            useValue: { isMatched: () => isHandset },
          },
        ],
      });
      const owner = createEnvironmentInjector(
        [],
        TestBed.inject(EnvironmentInjector),
      );

      const answer = TestBed.inject(ReconcileSheet).open(
        Body,
        {},
        'Autres raisons',
        owner.get(DestroyRef),
      );
      owner.destroy();

      await expect(answer).resolves.toBeUndefined();
      expect(isHandset ? ref.dismiss : ref.close).toHaveBeenCalledTimes(1);
      expect(isHandset ? ref.close : ref.dismiss).not.toHaveBeenCalled();
    },
  );
});
