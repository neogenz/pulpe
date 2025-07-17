import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatNativeDateModule } from '@angular/material/core';

@Component({
  selector: 'pulpe-month-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>Nouveau budget</h2>

    <mat-dialog-content>
      <form [formGroup]="budgetForm" class="space-y-4 md:space-y-6">
        <!-- Month/Year Picker -->
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Mois et année</mat-label>
          <input
            matInput
            [matDatepicker]="monthYearPicker"
            formControlName="monthYear"
            readonly
          />
          <mat-datepicker-toggle
            matSuffix
            [for]="monthYearPicker"
          ></mat-datepicker-toggle>
          <mat-datepicker
            #monthYearPicker
            startView="multi-year"
            (monthSelected)="onMonthSelected($event, monthYearPicker)"
          >
          </mat-datepicker>
          @if (
            budgetForm.get('monthYear')?.invalid &&
            budgetForm.get('monthYear')?.touched
          ) {
            <mat-error>Le mois et l'année sont requis</mat-error>
          }
        </mat-form-field>

        <!-- Description Field -->
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Description</mat-label>
          <input
            matInput
            formControlName="description"
            maxlength="100"
            placeholder="Saisissez une description pour ce budget"
          />
          <mat-hint align="end">{{ descriptionLength() }}/100</mat-hint>
          @if (
            budgetForm.get('description')?.invalid &&
            budgetForm.get('description')?.touched
          ) {
            <mat-error>
              @if (budgetForm.get('description')?.errors?.['required']) {
                La description est requise
              }
              @if (budgetForm.get('description')?.errors?.['maxlength']) {
                La description ne peut pas dépasser 100 caractères
              }
            </mat-error>
          }
        </mat-form-field>

        <!-- Template Selection Button -->
        <div class="flex justify-center mt-4 md:mt-6">
          <button
            type="button"
            matButton="tonal"
            class="px-4 py-2 md:px-6 md:py-2"
            (click)="onSelectTemplate()"
          >
            Choisir un modèle
          </button>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions
      align="end"
      class="px-4 pb-4 md:px-6 md:pb-4 flex flex-col md:flex-row gap-2 md:gap-0"
    >
      <button mat-button mat-dialog-close class="order-2 md:order-1 md:mr-2">
        Annuler
      </button>
      <button
        matButton="filled"
        color="primary"
        [disabled]="budgetForm.invalid"
        (click)="onCreateBudget()"
        class="order-1 md:order-2 w-full md:w-auto"
      >
        Créer le budget
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
    }

    mat-dialog-content {
      max-height: 80vh;
      overflow-y: auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateBudgetDialogComponent {
  #formBuilder = inject(FormBuilder);
  #dialogRef = inject(MatDialogRef<CreateBudgetDialogComponent>);

  budgetForm: FormGroup;

  // Computed signal for description length
  descriptionLength = computed(() => {
    return this.budgetForm.get('description')?.value?.length || 0;
  });

  constructor() {
    // Initialize form with current year default
    const currentDate = new Date();
    currentDate.setDate(1); // Set to first day of current month

    this.budgetForm = this.#formBuilder.group({
      monthYear: [currentDate, Validators.required],
      description: ['', [Validators.required, Validators.maxLength(100)]],
    });
  }

  onMonthSelected(date: Date, datePicker: { close: () => void }): void {
    // Set the date to the first day of the selected month
    const selectedDate = new Date(date.getFullYear(), date.getMonth(), 1);
    this.budgetForm.get('monthYear')?.setValue(selectedDate);
    this.budgetForm.get('monthYear')?.markAsTouched();
    datePicker.close();
  }

  onSelectTemplate(): void {
    // TODO: Implement template selection logic
    console.log('Template selection clicked');
  }

  onCreateBudget(): void {
    if (this.budgetForm.valid) {
      const formValue = this.budgetForm.value;
      this.#dialogRef.close(formValue);
    }
  }
}
