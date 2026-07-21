import { provideZonelessChangeDetection, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { describe, beforeEach, expect, it, vi } from 'vitest';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { ApiError } from '@core/api/api-error';
import {
  ProductTourService,
  type ProductTourService as ProductTourServiceType,
} from '@core/product-tour/product-tour.service';
import { TitleDisplay } from '@core/routing';
import SavingsGoalsListPage from './savings-goals-list-page';
import { SavingsGoalsDialogService } from '../services/savings-goals-dialog.service';
import { SavingsGoalStore } from '../services/savings-goals-store';

describe('SavingsGoalsListPage', () => {
  let fixture: ComponentFixture<SavingsGoalsListPage>;
  let component: SavingsGoalsListPage;
  let store: {
    refresh: ReturnType<typeof vi.fn>;
    addGoal: ReturnType<typeof vi.fn>;
  };
  let dialogs: { openCreate: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    store = {
      refresh: vi.fn(),
      addGoal: vi.fn().mockResolvedValue(undefined),
    };
    dialogs = {
      openCreate: vi.fn().mockResolvedValue({
        name: 'Maison',
        targetAmount: 100_000,
        targetDate: '2030-05-15',
        status: 'ACTIVE',
        monthlyContribution: 2083.34,
      }),
    };
    snackBar = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SavingsGoalsListPage],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: SavingsGoalStore, useValue: store },
        { provide: SavingsGoalsDialogService, useValue: dialogs },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: TitleDisplay, useValue: { currentTitle: signal('') } },
        {
          provide: ProductTourService,
          useValue: {
            hasSeenPageTour: vi.fn().mockReturnValue(true),
            startPageTour: vi.fn(),
          } satisfies Partial<ProductTourServiceType>,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SavingsGoalsListPage);
    component = fixture.componentInstance;
  });

  it('creates a goal without showing an error', async () => {
    await component['onCreate']();

    expect(store.addGoal).toHaveBeenCalledOnce();
    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('localizes a committed baseline recalculation failure', async () => {
    store.addGoal.mockRejectedValue(
      new ApiError(
        'Goal and baseline committed but recalculation failed',
        'ERR_SAVINGS_GOAL_BASELINE_RECALCULATION_FAILED',
        500,
        null,
      ),
    );

    await component['onCreate']();

    expect(snackBar.open).toHaveBeenCalledWith(
      "L'objectif et sa prévision mensuelle ont bien été créés, mais les soldes n'ont pas pu être actualisés — recharge la page sans recréer l'objectif",
      'Fermer',
      expect.any(Object),
    );
  });
});
