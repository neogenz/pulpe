import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  AfterViewInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { CommonModule } from '@angular/common';

export interface TransactionFormData {
  amount: number;
  name: string;
  type: 'income' | 'expense' | 'saving';
  category?: string;
}

@Component({
  selector: 'pulpe-add-transaction-bottom-sheet',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
  ],
  template: `
    <div class="flex flex-col gap-4">
      <!-- Drag indicator -->
      <div
        class="w-9 h-1 bg-outline-variant rounded-sm mx-auto mt-3 mb-2"
      ></div>

      <!-- Header -->
      <div class="flex justify-between items-center">
        <h2 class="text-title-large text-on-surface m-0">
          Nouvelle transaction
        </h2>
        <button matIconButton (click)="close()" aria-label="Fermer">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Essential Form Fields -->
      <div class="flex flex-col gap-4">
        <!-- Amount Field - Focus priority -->
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Montant</mat-label>
          <input
            class="!text-xl !font-bold !text-center"
            matInput
            #amountInput
            type="number"
            inputmode="decimal"
            pattern="[0-9]*"
            placeholder="0.00"
            [(ngModel)]="amount"
            (keyup.enter)="onSubmit()"
            required
          />
          <span matTextSuffix>CHF</span>
        </mat-form-field>

        <!-- Predefined Amounts - Quick selection -->
        <div class="flex flex-col gap-3">
          <div class="text-sm font-medium text-on-surface-variant">
            Montants rapides
          </div>
          <div class="flex flex-wrap gap-2">
            @for (amount of predefinedAmounts(); track amount) {
              <button
                matButton="tonal"
                (click)="selectPredefinedAmount(amount)"
                class="!min-w-[80px] !h-[40px]"
              >
                {{ amount }} CHF
              </button>
            }
          </div>
        </div>

        <!-- Description (Optional) -->
        <mat-form-field appearance="outline">
          <mat-label>Description (optionnel)</mat-label>
          <input
            matInput
            [(ngModel)]="description"
            placeholder="Ex: Courses chez Migros"
            (keyup.enter)="onSubmit()"
          />
        </mat-form-field>

        <!-- Date display (today by default) -->
        <div
          class="flex items-center gap-2 p-3 bg-surface-container rounded-lg text-on-surface-variant"
        >
          <mat-icon>event</mat-icon>
          <span>Aujourd'hui</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-3 pt-4 pb-6 px-6 border-t border-outline-variant">
        <button matButton (click)="close()" class="flex-1">Annuler</button>
        <button
          matButton="outlined"
          (click)="onSubmit()"
          [disabled]="!isFormValid()"
          class="flex-2"
        >
          Ajouter
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTransactionBottomSheet implements AfterViewInit {
  @ViewChild('amountInput') amountInput!: ElementRef<HTMLInputElement>;

  private readonly bottomSheetRef = inject(
    MatBottomSheetRef<AddTransactionBottomSheet>,
  );

  // Form state
  amount = signal<number | null>(null);
  description = signal('');
  selectedCategory = signal<string | null>(null);

  // Predefined amounts for quick selection
  predefinedAmounts = signal([10, 15, 20, 30]);
  selectedPredefinedAmount = signal<number | null>(null);

  // TODO: Categories to be restored later
  // categories = signal([
  //   { id: 'food', name: 'Nourriture', icon: 'restaurant' },
  //   { id: 'transport', name: 'Transport', icon: 'directions_car' },
  //   { id: 'shopping', name: 'Shopping', icon: 'shopping_cart' },
  //   { id: 'entertainment', name: 'Loisirs', icon: 'movie' },
  //   { id: 'health', name: 'Santé', icon: 'local_hospital' },
  //   { id: 'other', name: 'Autre', icon: 'more_horiz' },
  // ]);

  // Form validation
  isFormValid = computed(() => {
    return this.amount() !== null && this.amount()! > 0;
  });

  ngAfterViewInit() {
    // Auto-focus on amount field for immediate input
    setTimeout(() => {
      this.amountInput?.nativeElement?.focus();
    }, 200);
  }

  selectCategory(categoryId: string): void {
    this.selectedCategory.set(categoryId);
  }

  selectPredefinedAmount(amount: number): void {
    this.selectedPredefinedAmount.set(amount);
    this.amount.set(amount);
  }

  onSubmit(): void {
    if (!this.isFormValid()) return;

    const transaction: TransactionFormData = {
      amount: this.amount()!,
      name: this.description() || 'Dépense',
      type: 'expense',
      category: this.selectedCategory() || undefined,
    };

    this.bottomSheetRef.dismiss(transaction);
  }

  close(): void {
    this.bottomSheetRef.dismiss();
  }
}
