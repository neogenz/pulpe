import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { inject, Injector, Service } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoService } from '@jsverse/transloco';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@ui/dialogs/confirmation-dialog';
import { firstValueFrom } from 'rxjs';
import { AddTransactionBottomSheet } from '../components/add-transaction-bottom-sheet';
import { AddTransactionDialog } from '../components/add-transaction-dialog';
import type { TransactionFormData } from '../components/add-transaction-form';

/**
 * Ce que la coque reçoit : la façon d'enregistrer ce qu'on vient d'y saisir.
 * Elle rend la raison d'un refus, ou `null` quand l'écriture est passée.
 */
export interface AddTransactionShellData {
  readonly persist: (
    transaction: TransactionFormData,
  ) => Promise<string | null>;
}

@Service({ autoProvided: false })
export class AddTransactionDialogService {
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #bottomSheet = inject(MatBottomSheet);
  readonly #dialog = inject(MatDialog);
  readonly #injector = inject(Injector);
  readonly #transloco = inject(TranslocoService);

  /**
   * Ouvre la saisie et ne la referme qu'une fois l'écriture acceptée.
   *
   * `persist` rend la raison du refus, ou `null` si c'est passé. La coque
   * attend cette réponse avant de se fermer : c'est elle qui détient le
   * montant, le libellé, les tags et l'objet d'épargne, et le POST partait
   * après sa destruction. Une session expirée, un 500, le mode avion — la
   * saisie disparaissait et il ne restait qu'un toast. Le même formulaire
   * demande pourtant confirmation avant de perdre ces champs sur un clic à
   * côté : un refus serveur ne peut pas être moins prudent qu'une maladresse.
   */
  async open(
    persist: (transaction: TransactionFormData) => Promise<string | null>,
  ): Promise<TransactionFormData | undefined> {
    if (this.#breakpointObserver.isMatched(Breakpoints.Handset)) {
      const bottomSheetRef = this.#bottomSheet.open(AddTransactionBottomSheet, {
        data: { persist } satisfies AddTransactionShellData,
        autoFocus: '[inputmode="decimal"]',
        // Les deux coques interceptent elles-mêmes le clic hors cadre et Échap
        // pour demander confirmation quand quelque chose a été saisi. Elles ne
        // peuvent le faire que si Material ne ferme pas avant elles.
        disableClose: true,
        // Ce service est fourni par la route, donc absent de l'injecteur racine
        // dont héritent dialogues et feuilles : sans ce relais, la coque ne
        // pourrait pas rappeler `confirmDiscard`.
        injector: this.#injector,
      });
      return firstValueFrom(bottomSheetRef.afterDismissed());
    }

    const dialogRef = this.#dialog.open(AddTransactionDialog, {
      data: { persist } satisfies AddTransactionShellData,
      width: '720px',
      maxWidth: 'calc(100vw - 48px)',
      panelClass: 'add-transaction-dialog',
      autoFocus: '[inputmode="decimal"]',
      disableClose: true,
      injector: this.#injector,
    });
    return firstValueFrom(dialogRef.afterClosed());
  }

  /**
   * Vrai quand l'utilisateur accepte de perdre ce qu'il a saisi. Le formulaire
   * n'a pas de brouillon : un clic à côté effaçait montant, description, tags
   * et objet d'épargne sans rien demander, alors que la même écriture, une fois
   * réussie, se rattrape pendant six secondes.
   */
  async confirmDiscard(): Promise<boolean> {
    const dialogRef = this.#dialog.open(ConfirmationDialog, {
      data: {
        title: this.#transloco.translate(
          'currentMonth.addTransactionDiscardTitle',
        ),
        message: this.#transloco.translate(
          'currentMonth.addTransactionDiscardMessage',
        ),
        confirmText: this.#transloco.translate(
          'currentMonth.addTransactionDiscardConfirm',
        ),
        cancelText: this.#transloco.translate(
          'currentMonth.addTransactionDiscardCancel',
        ),
        confirmColor: 'warn',
      } satisfies ConfirmationDialogData,
      width: '400px',
    });
    return (await firstValueFrom(dialogRef.afterClosed())) === true;
  }
}
