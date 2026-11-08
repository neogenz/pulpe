import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { Asset, AssetCategory } from 'pulpe-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { NetWorthStore } from '../services/net-worth-store';
import { AssetCategoriesDialog } from './asset-categories-dialog';

const FULL = '11111111-1111-4111-8111-111111111111';
const EMPTY = '22222222-2222-4222-8222-222222222222';

const categories: AssetCategory[] = [
  { id: FULL, name: 'Comptes', total: 100 },
  { id: EMPTY, name: 'Cash', total: 0 },
];
const assets = [
  {
    id: 'a1',
    categoryId: FULL,
    name: 'UBS',
    currency: 'CHF',
    direction: 'own',
    inPulpe: false,
    archivedAt: '2026-10-01T00:00:00.000Z',
    latestValue: 100,
    latestRecordedAt: '2026-11-03T10:00:00.000Z',
    convertedValue: 100,
    suggestion: null,
  },
] satisfies Asset[];

describe('AssetCategoriesDialog', () => {
  let fixture: ComponentFixture<AssetCategoriesDialog>;
  const store = {
    categories: signal(categories),
    assets: signal<Asset[]>(assets),
    addCategory: vi.fn(),
    renameCategory: vi.fn(),
    deleteCategory: vi.fn(),
    isSaving: signal(false),
  };
  const snackBar = { open: vi.fn() };

  const all = (id: string) =>
    [
      ...fixture.nativeElement.querySelectorAll(`[data-testid="${id}"]`),
    ] as HTMLElement[];
  const flush = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    store.addCategory.mockResolvedValue(undefined);
    store.renameCategory.mockResolvedValue(undefined);
    store.deleteCategory.mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [AssetCategoriesDialog],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: NetWorthStore, useValue: store },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(AssetCategoriesDialog);
    fixture.detectChanges();
  });

  it('refuses to delete a category that still holds an archived asset, and names it', async () => {
    all('asset-category-delete-button')[0].click();
    await flush();

    expect(store.deleteCategory).not.toHaveBeenCalled();
    expect(all('asset-category-blocked')[0].textContent).toContain('UBS');
  });

  it('deletes an empty category', async () => {
    all('asset-category-delete-button')[1].click();
    await flush();

    expect(store.deleteCategory).toHaveBeenCalledWith(EMPTY);
  });

  it('renames a category with the trimmed draft', async () => {
    all('asset-category-rename-button')[0].click();
    fixture.detectChanges();
    const input = all('asset-category-rename-input')[0] as HTMLInputElement;
    input.value = '  Banques  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    all('asset-category-rename-save-button')[0].click();
    await flush();

    expect(store.renameCategory).toHaveBeenCalledWith(FULL, 'Banques');
    expect(all('asset-category-rename-input')).toHaveLength(0);
  });

  it('adds a category and clears the field, or keeps the draft and warns on failure', async () => {
    const input = all('asset-category-new-input')[0] as HTMLInputElement;
    input.value = 'Crypto';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    all('asset-category-add-button')[0].click();
    await flush();

    expect(store.addCategory).toHaveBeenCalledWith('Crypto');
    expect(input.value).toBe('');

    store.addCategory.mockRejectedValue(new Error('boom'));
    input.value = 'Doublon';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    all('asset-category-add-button')[0].click();
    await flush();

    expect(snackBar.open).toHaveBeenCalledOnce();
    expect(input.value).toBe('Doublon');
  });
});
