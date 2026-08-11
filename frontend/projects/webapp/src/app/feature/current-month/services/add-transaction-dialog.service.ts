import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { inject, Service } from '@angular/core';
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
import type { AddTransactionShellData } from '../components/add-transaction-shell-data';

@Service({ autoProvided: false })
export class AddTransactionDialogService {
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #bottomSheet = inject(MatBottomSheet);
  readonly #dialog = inject(MatDialog);
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
    // `confirmDiscard` voyage avec `persist` plutôt que d'être injecté par la
    // coque : ce service importe les deux coques pour les ouvrir, donc l'inverse
    // fermait un cycle. Les deux façons de disposer de la saisie arrivent ainsi
    // du même endroit.
    const data = {
      persist,
      confirmDiscard: () => this.confirmDiscard(),
    } satisfies AddTransactionShellData;

    if (this.#breakpointObserver.isMatched(Breakpoints.Handset)) {
      const bottomSheetRef = this.#bottomSheet.open(AddTransactionBottomSheet, {
        data,
        autoFocus: '[inputmode="decimal"]',
        // Les deux coques interceptent elles-mêmes le clic hors cadre et Échap
        // pour demander confirmation quand quelque chose a été saisi. Elles ne
        // peuvent le faire que si Material ne ferme pas avant elles.
        disableClose: true,
      });
      return firstValueFrom(bottomSheetRef.afterDismissed());
    }

    const dialogRef = this.#dialog.open(AddTransactionDialog, {
      data,
      width: '720px',
      maxWidth: 'calc(100vw - 48px)',
      panelClass: 'add-transaction-dialog',
      autoFocus: '[inputmode="decimal"]',
      disableClose: true,
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
