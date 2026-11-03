import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { UserSettingsStore } from '@core/user-settings';
import type { Asset, AssetCategory } from 'pulpe-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetFormDialog, type AssetFormDialogData } from './asset-form-dialog';

const CHECKING = '11111111-1111-4111-8111-111111111111';

const categories: AssetCategory[] = [
  { id: CHECKING, name: 'Comptes', total: 0 },
];

const asset: Asset = {
  id: '22222222-2222-4222-8222-222222222222',
  categoryId: CHECKING,
  name: 'UBS',
  currency: 'EUR',
  direction: 'own',
  inPulpe: true,
  archivedAt: null,
  latestValue: 1000,
  latestRecordedAt: '2026-11-03T10:00:00.000Z',
  convertedValue: 950,
};

describe('AssetFormDialog', () => {
  const close = vi.fn();

  function render(
    data: AssetFormDialogData,
  ): ComponentFixture<AssetFormDialog> {
    TestBed.configureTestingModule({
      imports: [AssetFormDialog],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: data },
        {
          provide: UserSettingsStore,
          useValue: { currency: signal('CHF' as const) },
        },
      ],
    });
    const fixture = TestBed.createComponent(AssetFormDialog);
    fixture.detectChanges();
    return fixture;
  }

  const byTestId = (fixture: ComponentFixture<AssetFormDialog>, id: string) =>
    fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement;

  function type(
    fixture: ComponentFixture<AssetFormDialog>,
    id: string,
    text: string,
  ): void {
    const input = byTestId(fixture, id) as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  async function pickCategory(
    fixture: ComponentFixture<AssetFormDialog>,
    label: string,
  ): Promise<void> {
    byTestId(fixture, 'asset-category-select')
      .querySelector<HTMLElement>('.mat-mdc-select-trigger')!
      .click();
    fixture.detectChanges();
    const option = [
      ...document.querySelectorAll<HTMLElement>('mat-option'),
    ].find((element) => element.textContent?.includes(label));
    option!.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const submitButton = (fixture: ComponentFixture<AssetFormDialog>) =>
    byTestId(fixture, 'asset-submit-button') as HTMLButtonElement;

  beforeEach(() => {
    TestBed.resetTestingModule();
    close.mockClear();
  });

  it('creates an asset in an existing category', async () => {
    const fixture = render({ categories });
    expect(submitButton(fixture).disabled).toBe(true);

    type(fixture, 'asset-name-input', 'Compte courant');
    type(fixture, 'asset-value-input', '1250.5');
    await pickCategory(fixture, 'Comptes');
    expect(submitButton(fixture).disabled).toBe(false);

    submitButton(fixture).click();

    expect(close).toHaveBeenCalledWith({
      asset: {
        name: 'Compte courant',
        currency: 'CHF',
        direction: 'own',
        inPulpe: false,
        value: 1250.5,
      },
      category: { id: CHECKING },
    });
  });

  it('offers only the starter suggestions not yet used, and creates the picked one on save', async () => {
    const fixture = render({ categories });
    byTestId(fixture, 'asset-category-select')
      .querySelector<HTMLElement>('.mat-mdc-select-trigger')!
      .click();
    fixture.detectChanges();
    const labels = [
      ...document.querySelectorAll<HTMLElement>('mat-option'),
    ].map((element) => element.textContent ?? '');
    expect(labels.filter((label) => label.includes('Comptes'))).toHaveLength(1);
    expect(labels.some((label) => label.includes('Placements'))).toBe(true);
    document.body.click();

    type(fixture, 'asset-name-input', 'ETF monde');
    type(fixture, 'asset-value-input', '500');
    await pickCategory(fixture, 'Placements');
    submitButton(fixture).click();

    expect(close).toHaveBeenCalledWith(
      expect.objectContaining({ category: { name: 'Placements' } }),
    );
  });

  it('refuses a negative first value', async () => {
    const fixture = render({ categories });
    type(fixture, 'asset-name-input', 'Compte courant');
    type(fixture, 'asset-value-input', '-10');
    await pickCategory(fixture, 'Comptes');

    expect(submitButton(fixture).disabled).toBe(true);
  });

  it('edits name, category and Pulpe link only, without asking for a value', () => {
    const fixture = render({ categories, asset });

    expect(byTestId(fixture, 'asset-value-input')).toBeNull();
    type(fixture, 'asset-name-input', 'UBS Pro');
    submitButton(fixture).click();

    expect(close).toHaveBeenCalledWith({
      updates: { name: 'UBS Pro', inPulpe: true },
      category: { id: CHECKING },
    });
  });
});
