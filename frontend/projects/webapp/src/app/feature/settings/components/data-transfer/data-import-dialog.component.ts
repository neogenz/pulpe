import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatListModule } from '@angular/material/list';
import { MatExpansionModule } from '@angular/material/expansion';
import {
  DataTransferService,
  ImportMode,
  type ExportData,
  type ImportResult,
} from '../../../../core/services/data-transfer.service';

interface DialogData {
  file: File;
}

@Component({
  selector: 'pulpe-data-import-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatSnackBarModule,
    MatListModule,
    MatExpansionModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="mr-2 align-middle">upload</mat-icon>
      Importer les données
    </h2>

    <mat-dialog-content class="space-y-4">
      @if (!fileData() && !isLoading()) {
        <div class="text-center py-4">
          <mat-spinner diameter="40"></mat-spinner>
          <p class="mt-2">Lecture du fichier...</p>
        </div>
      }

      @if (fileData() && !validationResult()) {
        <!-- File Preview -->
        <div class="file-preview bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h3 class="text-base font-medium mb-3">Aperçu du fichier</h3>

          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-gray-600 dark:text-gray-400">Version :</p>
              <p class="font-medium">{{ fileData()?.version }}</p>
            </div>
            <div>
              <p class="text-gray-600 dark:text-gray-400">Date d'export :</p>
              <p class="font-medium">
                {{ fileData()?.exported_at | date: 'short' }}
              </p>
            </div>
          </div>

          <mat-expansion-panel class="mt-4">
            <mat-expansion-panel-header>
              <mat-panel-title> Contenu du fichier </mat-panel-title>
            </mat-expansion-panel-header>

            <mat-list dense>
              <mat-list-item>
                <mat-icon matListItemIcon>folder</mat-icon>
                <span matListItemTitle
                  >{{ fileData()?.metadata?.total_templates }} modèles</span
                >
              </mat-list-item>
              <mat-list-item>
                <mat-icon matListItemIcon>calendar_month</mat-icon>
                <span matListItemTitle
                  >{{ fileData()?.metadata?.total_budgets }} budgets
                  mensuels</span
                >
              </mat-list-item>
              <mat-list-item>
                <mat-icon matListItemIcon>receipt</mat-icon>
                <span matListItemTitle
                  >{{
                    fileData()?.metadata?.total_transactions
                  }}
                  transactions</span
                >
              </mat-list-item>
              <mat-list-item>
                <mat-icon matListItemIcon>savings</mat-icon>
                <span matListItemTitle
                  >{{ fileData()?.metadata?.total_savings_goals }} objectifs
                  d'épargne</span
                >
              </mat-list-item>
            </mat-list>

            @if (fileData()?.metadata?.date_range?.oldest_budget) {
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Période :
                {{
                  fileData()?.metadata?.date_range?.oldest_budget
                    | date: 'MMM yyyy'
                }}
                -
                {{
                  fileData()?.metadata?.date_range?.newest_budget
                    | date: 'MMM yyyy'
                }}
              </p>
            }
          </mat-expansion-panel>
        </div>
      }

      <!-- Validation Result -->
      @if (validationResult()) {
        <div class="validation-result">
          @if (validationResult()?.success) {
            <div
              class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4"
            >
              <div class="flex items-start">
                <mat-icon class="text-green-600 dark:text-green-500 mr-2"
                  >check_circle</mat-icon
                >
                <div>
                  <p class="font-medium text-green-800 dark:text-green-400">
                    Validation réussie
                  </p>
                  <p class="text-sm text-green-700 dark:text-green-500 mt-1">
                    Le fichier est valide et prêt à être importé.
                  </p>
                </div>
              </div>
            </div>
          } @else {
            <div
              class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
            >
              <div class="flex items-start">
                <mat-icon class="text-red-600 dark:text-red-500 mr-2"
                  >error</mat-icon
                >
                <div>
                  <p class="font-medium text-red-800 dark:text-red-400">
                    Erreur de validation
                  </p>
                  @if (validationResult()?.errors?.length) {
                    <ul
                      class="text-sm text-red-700 dark:text-red-500 mt-2 list-disc list-inside"
                    >
                      @for (error of validationResult()?.errors; track error) {
                        <li>{{ error }}</li>
                      }
                    </ul>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Import Result -->
      @if (importResult()) {
        <div class="import-result">
          @if (importResult()?.success) {
            <div
              class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4"
            >
              <div class="flex items-start">
                <mat-icon class="text-green-600 dark:text-green-500 mr-2"
                  >check_circle</mat-icon
                >
                <div class="flex-1">
                  <p class="font-medium text-green-800 dark:text-green-400">
                    Importation réussie !
                  </p>
                  <p class="text-sm text-green-700 dark:text-green-500 mt-1">
                    {{ importResult()?.message }}
                  </p>

                  <div class="grid grid-cols-2 gap-2 mt-3 text-sm">
                    @if (importResult()?.imported?.templates) {
                      <div>
                        ✓ {{ importResult()?.imported?.templates }} modèles
                        importés
                      </div>
                    }
                    @if (importResult()?.imported?.monthly_budgets) {
                      <div>
                        ✓
                        {{ importResult()?.imported?.monthly_budgets }} budgets
                        importés
                      </div>
                    }
                    @if (importResult()?.imported?.transactions) {
                      <div>
                        ✓
                        {{ importResult()?.imported?.transactions }}
                        transactions importées
                      </div>
                    }
                    @if (importResult()?.imported?.savings_goals) {
                      <div>
                        ✓
                        {{ importResult()?.imported?.savings_goals }} objectifs
                        importés
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>
          } @else {
            <div
              class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4"
            >
              <div class="flex items-start">
                <mat-icon class="text-amber-600 dark:text-amber-500 mr-2"
                  >warning</mat-icon
                >
                <div>
                  <p class="font-medium text-amber-800 dark:text-amber-400">
                    Importation partielle
                  </p>
                  <p class="text-sm text-amber-700 dark:text-amber-500 mt-1">
                    {{ importResult()?.message }}
                  </p>
                  @if (importResult()?.errors?.length) {
                    <ul
                      class="text-sm text-amber-700 dark:text-amber-500 mt-2 list-disc list-inside"
                    >
                      @for (error of importResult()?.errors; track error) {
                        <li>{{ error }}</li>
                      }
                    </ul>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="isLoading()">
        Annuler
      </button>

      @if (fileData() && !importResult()) {
        @if (!validationResult()) {
          <button
            mat-button="filled"
            color="primary"
            [disabled]="isLoading()"
            (click)="validateData()"
          >
            @if (isLoading()) {
              <mat-spinner
                diameter="20"
                class="mr-2 inline-block"
              ></mat-spinner>
              Validation...
            } @else {
              Valider les données
            }
          </button>
        } @else if (validationResult()?.success) {
          <button
            mat-button="filled"
            color="accent"
            [disabled]="isLoading()"
            (click)="importData()"
          >
            @if (isLoading()) {
              <mat-spinner
                diameter="20"
                class="mr-2 inline-block"
              ></mat-spinner>
              Importation...
            } @else {
              Confirmer l'importation
            }
          </button>
        }
      }

      @if (importResult()?.success) {
        <button
          mat-button="filled"
          color="primary"
          [mat-dialog-close]="{ imported: true }"
        >
          Terminer
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        max-height: 70vh;
        overflow-y: auto;
      }

      mat-radio-button {
        margin-bottom: 0.5rem;
      }

      mat-spinner {
        display: inline-block;
        vertical-align: middle;
      }

      .file-preview {
        max-height: 300px;
        overflow-y: auto;
      }

      mat-expansion-panel {
        box-shadow: none !important;
        background: transparent;
      }
    `,
  ],
})
export class DataImportDialogComponent {
  readonly #dialogRef = inject(MatDialogRef<DataImportDialogComponent>);
  readonly #data = inject<DialogData>(MAT_DIALOG_DATA);
  readonly #dataTransferService = inject(DataTransferService);
  readonly #snackBar = inject(MatSnackBar);

  readonly isLoading = signal(false);
  readonly fileData = signal<ExportData | null>(null);
  readonly validationResult = signal<ImportResult | null>(null);
  readonly importResult = signal<ImportResult | null>(null);

  constructor() {
    this.loadFileData();
  }

  private loadFileData(): void {
    this.#dataTransferService.readImportFile(this.#data.file).subscribe({
      next: (data) => {
        this.fileData.set(data);
      },
      error: (error) => {
        console.error('Error reading file:', error);
        this.#snackBar.open('Erreur lors de la lecture du fichier', 'Fermer', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
        this.#dialogRef.close();
      },
    });
  }

  validateData(): void {
    const data = this.fileData();
    if (!data) return;

    this.isLoading.set(true);

    this.#dataTransferService
      .validateImportData(data, {
        mode: ImportMode.REPLACE,
        dryRun: true,
      })
      .subscribe({
        next: (result) => {
          this.validationResult.set(result);
        },
        error: (error) => {
          console.error('Validation error:', error);
          this.validationResult.set({
            success: false,
            message: 'Erreur lors de la validation',
            imported: {
              templates: 0,
              template_lines: 0,
              monthly_budgets: 0,
              budget_lines: 0,
              transactions: 0,
              savings_goals: 0,
            },
            errors: [error.message],
          });
        },
        complete: () => {
          this.isLoading.set(false);
        },
      });
  }

  importData(): void {
    const data = this.fileData();
    if (!data) return;

    this.isLoading.set(true);

    this.#dataTransferService
      .importUserData(data, {
        mode: ImportMode.REPLACE,
        dryRun: false,
      })
      .subscribe({
        next: (result) => {
          this.importResult.set(result);
          if (result.success) {
            this.#snackBar.open('Données importées avec succès', 'Fermer', {
              duration: 3000,
              panelClass: ['success-snackbar'],
            });
          }
        },
        error: (error) => {
          console.error('Import error:', error);
          this.#snackBar.open("Erreur lors de l'importation", 'Fermer', {
            duration: 5000,
            panelClass: ['error-snackbar'],
          });
        },
        complete: () => {
          this.isLoading.set(false);
        },
      });
  }
}
