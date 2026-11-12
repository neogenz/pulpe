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
  suggestion: null,
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

  const optionLabels = (fixture: ComponentFixture<AssetFormDialog>) => {
    byTestId(fixture, 'asset-category-select')
      .querySelector<HTMLElement>('.mat-mdc-select-trigger')!
      .click();
    fixture.detectChanges();
    const labels = [
      ...document.querySelectorAll<HTMLElement>('mat-option'),
    ].map((element) => element.textContent?.trim() ?? '');
    document.body.click();
    return labels;
  };

  it('creates an asset in the Type preselected for what I own', () => {
    const fixture = render({ categories, assets: [asset] });
    expect(submitButton(fixture).disabled).toBe(true);

    type(fixture, 'asset-name-input', 'Compte courant');
    type(fixture, 'asset-value-input', '1250.5');
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

  it('preselects « Comptes » as a suggestion when nothing exists yet', () => {
    const fixture = render({ categories: [], assets: [] });
    type(fixture, 'asset-name-input', 'Compte courant');
    type(fixture, 'asset-value-input', '10');
    submitButton(fixture).click();

    expect(close).toHaveBeenCalledWith(
      expect.objectContaining({ category: { name: 'Comptes' } }),
    );
  });

  it('lists used Types once, then the unused suggestions, then « Autre type… »', () => {
    const fixture = render({ categories, assets: [asset] });

    expect(optionLabels(fixture)).toEqual([
      'Comptes',
      'Épargne',
      'Placements',
      'Cash',
      'Objets de valeur',
      'Biens',
      'Autre type…',
    ]);
  });

  it('switches to the debt suggestions, preselects the first and hides the overdraft box', () => {
    const fixture = render({ categories, assets: [asset] });
    expect(byTestId(fixture, 'asset-overdraft-checkbox')).not.toBeNull();

    byTestId(fixture, 'asset-direction-toggle')
      .querySelectorAll<HTMLElement>('button')[1]
      .click();
    fixture.detectChanges();

    expect(optionLabels(fixture)).toEqual([
      'Crédit',
      'Hypothèque',
      'Leasing',
      'Carte de crédit',
      'Autre type…',
    ]);
    expect(byTestId(fixture, 'asset-overdraft-checkbox')).toBeNull();
    type(fixture, 'asset-name-input', 'Prêt auto');
    type(fixture, 'asset-value-input', '8000');
    submitButton(fixture).click();
    expect(close).toHaveBeenCalledWith(
      expect.objectContaining({ category: { name: 'Crédit' } }),
    );
  });

  it('asks for a name after « Autre type… » and saves it as the Type', async () => {
    const fixture = render({ categories, assets: [asset] });
    type(fixture, 'asset-name-input', 'Bitcoin');
    type(fixture, 'asset-value-input', '500');
    await pickCategory(fixture, 'Autre type…');
    expect(submitButton(fixture).disabled).toBe(true);

    // Left empty, the field says why saving is off; typing is capped at what
    // the API accepts, so no name can be refused for its length.
    const typeName = byTestId(
      fixture,
      'asset-type-name-input',
    ) as HTMLInputElement;
    typeName.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Donne-lui un nom');
    expect(typeName.maxLength).toBe(30);
    expect(
      (byTestId(fixture, 'asset-name-input') as HTMLInputElement).maxLength,
    ).toBe(100);

    type(fixture, 'asset-type-name-input', 'Crypto');
    submitButton(fixture).click();

    expect(close).toHaveBeenCalledWith(
      expect.objectContaining({ category: { name: 'Crypto' } }),
    );
  });

  it('refuses a negative value', () => {
    const fixture = render({ categories, assets: [asset] });
    type(fixture, 'asset-name-input', 'Compte courant');
    type(fixture, 'asset-value-input', '-10');

    expect(submitButton(fixture).disabled).toBe(true);
  });

  describe('editing', () => {
    const value = (fixture: ComponentFixture<AssetFormDialog>) =>
      (byTestId(fixture, 'asset-value-input') as HTMLInputElement).value;

    it('starts from the current value and sends only a changed value', async () => {
      const fixture = render({ categories, assets: [asset], asset });
      await fixture.whenStable();
      expect(value(fixture)).toBe('1000');
      expect(fixture.nativeElement.textContent).toContain('Dernière valeur');

      type(fixture, 'asset-value-input', '1400');
      submitButton(fixture).click();

      expect(close).toHaveBeenCalledWith({ value: 1400 });
    });

    it('sends only a changed name', () => {
      const fixture = render({ categories, assets: [asset], asset });
      type(fixture, 'asset-name-input', 'UBS Pro');
      submitButton(fixture).click();

      expect(close).toHaveBeenCalledWith({ updates: { name: 'UBS Pro' } });
    });

    it('closes without a request when nothing changed', () => {
      const fixture = render({ categories, assets: [asset], asset });
      submitButton(fixture).click();

      expect(close).toHaveBeenCalledWith(undefined);
    });

    it('shows the magnitude of an overdrawn account with the box ticked', async () => {
      const overdrawn = { ...asset, latestValue: -250 };
      const fixture = render({
        categories,
        assets: [overdrawn],
        asset: overdrawn,
      });
      await fixture.whenStable();

      expect(value(fixture)).toBe('250');
      expect(
        byTestId(fixture, 'asset-overdraft-checkbox').querySelector('input')!
          .checked,
      ).toBe(true);
    });
  });
});
