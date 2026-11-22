import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Asset } from 'pulpe-shared';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import {
  ReconcileAddAccountSheet,
  type AddAccountSheetData,
} from './reconcile-add-account-sheet';

const PEL = { id: 'a', name: 'PostFinance', direction: 'own' } as Asset;
const CARD = { id: 'b', name: 'Carte Cembra', direction: 'owe' } as Asset;

function setup(data: AddAccountSheetData) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      ...provideTranslocoForTest(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(ReconcileAddAccountSheet);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const q = (id: string) =>
    host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  return { host, q, close };
}

describe('ReconcileAddAccountSheet', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('should say what belongs here and offer a new account and a sum I owe', () => {
    const view = setup({ groups: [] });

    expect(view.host.textContent).toContain(
      "Seulement les comptes de tes dépenses. Pas l'épargne.",
    );
    view.q('reconcile-add-new-button')!.click();
    view.q('reconcile-add-owe-button')!.click();

    expect(view.close).toHaveBeenNthCalledWith(1, {
      kind: 'free',
      side: 'own',
    });
    expect(view.close).toHaveBeenNthCalledWith(2, {
      kind: 'free',
      side: 'owe',
    });
  });

  it('should hide the Mon patrimoine block when nothing is on offer (flag off)', () => {
    const view = setup({ groups: [] });

    expect(view.host.textContent).not.toContain('Depuis Mon patrimoine');
  });

  it('should group Mon patrimoine items by type, each with its side', () => {
    const view = setup({
      groups: [
        { name: 'Comptes', items: [PEL] },
        { name: 'Cartes et crédits', items: [CARD] },
      ],
    });

    expect(view.host.textContent).toContain('Depuis Mon patrimoine');
    expect(view.host.textContent).toContain('Mis à jour avec ce que tu tapes');
    expect(view.host.textContent).toContain('Cartes et crédits');
    view.host
      .querySelectorAll<HTMLElement>(
        '[data-testid="reconcile-add-asset-button"]',
      )[1]
      .click();
    expect(view.close).toHaveBeenCalledWith({ kind: 'asset', asset: CARD });
    expect(view.host.textContent).toContain('Je dois');
  });
});
