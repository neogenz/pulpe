import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { AppVersionStore } from '@core/app-version';
import { PAGE_RELOAD } from '@core/page-reload';

import { ForceUpdateGate } from './force-update-gate';

describe('ForceUpdateGate', () => {
  let fixture: ComponentFixture<ForceUpdateGate>;
  const reloadSpy = vi.fn();
  const isUpdateRequiredSignal = signal(false);

  beforeEach(async () => {
    reloadSpy.mockReset();
    isUpdateRequiredSignal.set(false);

    await TestBed.configureTestingModule({
      imports: [ForceUpdateGate],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        {
          provide: AppVersionStore,
          useValue: { isUpdateRequired: isUpdateRequiredSignal.asReadonly() },
        },
        { provide: PAGE_RELOAD, useValue: reloadSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForceUpdateGate);
    await fixture.whenStable();
  });

  it('should render nothing when no update is required', () => {
    const wall = fixture.nativeElement.querySelector(
      '[data-testid="force-update-reload-button"]',
    );

    expect(wall).toBeNull();
  });

  it('should render the blocking wall when an update is required', async () => {
    isUpdateRequiredSignal.set(true);
    await fixture.whenStable();

    const wall = fixture.nativeElement.querySelector('[role="alertdialog"]');

    expect(wall).not.toBeNull();
    expect(wall.textContent).toContain('Mise à jour requise');
  });

  it('should reload the page when the reload button is clicked', async () => {
    isUpdateRequiredSignal.set(true);
    await fixture.whenStable();

    const button = fixture.nativeElement.querySelector(
      '[data-testid="force-update-reload-button"]',
    );
    button.click();

    expect(reloadSpy).toHaveBeenCalledOnce();
  });
});
