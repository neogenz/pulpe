import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatRadioModule } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';
import { DataTransferService } from '../../../../core/services/data-transfer.service';
import { DataImportDialogComponent } from './data-import-dialog.component';

@Component({
  selector: 'pulpe-data-transfer',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatRadioModule,
    FormsModule,
  ],
  template: `
    <mat-card class="data-transfer-card">
      <mat-card-header>
        <mat-card-title>
          <mat-icon class="mr-2">sync_alt</mat-icon>
          Exportation et Importation des Données
        </mat-card-title>
        <mat-card-subtitle>
          Sauvegardez ou restaurez toutes vos données
        </mat-card-subtitle>
      </mat-card-header>

      <mat-card-content class="space-y-6">
        <!-- Export Section -->
        <div class="export-section">
          <h3 class="text-lg font-medium mb-3">Exporter vos données</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Téléchargez une copie complète de vos données au format JSON. Cette
            sauvegarde inclut tous vos modèles, budgets, transactions et
            objectifs d'épargne.
          </p>

          <button
            mat-button="filled"
            color="primary"
            [disabled]="isExporting()"
            (click)="exportData()"
            class="w-full sm:w-auto"
          >
            @if (isExporting()) {
              <mat-spinner
                diameter="20"
                class="mr-2 inline-block"
              ></mat-spinner>
              Exportation en cours...
            } @else {
              <mat-icon class="mr-2">download</mat-icon>
              Exporter mes données
            }
          </button>

          @if (lastExportDate()) {
            <p class="text-xs text-gray-500 mt-2">
              Dernière exportation : {{ lastExportDate() | date: 'short' }}
            </p>
          }
        </div>

        <div class="border-t pt-6"></div>

        <!-- Import Section -->
        <div class="import-section">
          <h3 class="text-lg font-medium mb-3">Importer des données</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Restaurez vos données à partir d'un fichier d'exportation JSON. Vous
            pouvez choisir de remplacer vos données actuelles ou de les
            fusionner.
          </p>

          <div class="space-y-4">
            <!-- File Input -->
            <div class="file-input-wrapper">
              <input
                type="file"
                accept=".json,application/json"
                #fileInput
                (change)="onFileSelected($event)"
                class="hidden"
              />

              <button
                mat-button="outlined"
                (click)="fileInput.click()"
                class="w-full sm:w-auto"
              >
                <mat-icon class="mr-2">folder_open</mat-icon>
                Sélectionner un fichier JSON
              </button>

              @if (selectedFileName()) {
                <p class="text-sm mt-2">
                  <mat-icon class="text-sm align-middle"
                    >insert_drive_file</mat-icon
                  >
                  {{ selectedFileName() }}
                </p>
              }
            </div>

            <!-- Import Button -->
            @if (selectedFile()) {
              <button
                mat-button="filled"
                color="accent"
                [disabled]="isImporting()"
                (click)="openImportDialog()"
                class="w-full sm:w-auto"
              >
                @if (isImporting()) {
                  <mat-spinner
                    diameter="20"
                    class="mr-2 inline-block"
                  ></mat-spinner>
                  Importation en cours...
                } @else {
                  <mat-icon class="mr-2">upload</mat-icon>
                  Importer les données
                }
              </button>
            }
          </div>
        </div>

        <!-- Warnings -->
        <div
          class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mt-6"
        >
          <div class="flex items-start">
            <mat-icon class="text-amber-600 dark:text-amber-500 mr-2"
              >warning</mat-icon
            >
            <div class="text-sm">
              <p class="font-medium text-amber-800 dark:text-amber-400 mb-1">
                Important
              </p>
              <ul
                class="list-disc list-inside space-y-1 text-amber-700 dark:text-amber-500"
              >
                <li>
                  Assurez-vous que le fichier d'importation provient d'une
                  source fiable
                </li>
                <li>
                  L'importation en mode "Remplacer" supprimera toutes vos
                  données actuelles
                </li>
                <li>
                  Il est recommandé d'exporter vos données actuelles avant
                  d'importer
                </li>
              </ul>
            </div>
          </div>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [
    `
      .data-transfer-card {
        max-width: 800px;
        margin: 0 auto;
      }

      .file-input-wrapper {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      mat-spinner {
        display: inline-block;
        vertical-align: middle;
      }

      .export-section,
      .import-section {
        animation: fadeIn 0.3s ease-in;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
  ],
})
export class DataTransferComponent {
  readonly #dataTransferService = inject(DataTransferService);
  readonly #snackBar = inject(MatSnackBar);
  readonly #dialog = inject(MatDialog);

  readonly isExporting = signal(false);
  readonly isImporting = signal(false);
  readonly selectedFile = signal<File | null>(null);
  readonly selectedFileName = signal<string>('');
  readonly lastExportDate = signal<Date | null>(null);

  async exportData(): Promise<void> {
    this.isExporting.set(true);

    try {
      this.#dataTransferService.exportUserData().subscribe({
        next: (data) => {
          this.#dataTransferService.downloadExportedData(data);
          this.lastExportDate.set(new Date());
          this.#snackBar.open('Données exportées avec succès', 'Fermer', {
            duration: 3000,
            panelClass: ['success-snackbar'],
          });
        },
        error: (error) => {
          console.error('Export error:', error);
          this.#snackBar.open(
            "Erreur lors de l'exportation des données",
            'Fermer',
            {
              duration: 5000,
              panelClass: ['error-snackbar'],
            },
          );
        },
        complete: () => {
          this.isExporting.set(false);
        },
      });
    } catch (error) {
      this.isExporting.set(false);
      console.error('Export error:', error);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      if (!file.name.endsWith('.json')) {
        this.#snackBar.open('Veuillez sélectionner un fichier JSON', 'Fermer', {
          duration: 3000,
          panelClass: ['error-snackbar'],
        });
        return;
      }

      this.selectedFile.set(file);
      this.selectedFileName.set(file.name);
    }
  }

  openImportDialog(): void {
    const file = this.selectedFile();
    if (!file) return;

    const dialogRef = this.#dialog.open(DataImportDialogComponent, {
      width: '600px',
      data: { file },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.imported) {
        // Reset file selection after successful import
        this.selectedFile.set(null);
        this.selectedFileName.set('');
      }
    });
  }
}
