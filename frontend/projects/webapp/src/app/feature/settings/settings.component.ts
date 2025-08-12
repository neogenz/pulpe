import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { DataTransferComponent } from './components/data-transfer/data-transfer.component';

@Component({
  selector: 'pulpe-settings',
  standalone: true,
  imports: [CommonModule, MatTabsModule, MatIconModule, DataTransferComponent],
  template: `
    <div class="settings-container p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <h1 class="text-2xl md:text-3xl font-bold mb-6">Paramètres</h1>

      <mat-tab-group animationDuration="200ms">
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="mr-2">person</mat-icon>
            Profil
          </ng-template>
          <div class="tab-content p-4">
            <p class="text-gray-600 dark:text-gray-400">
              Les paramètres du profil seront bientôt disponibles.
            </p>
          </div>
        </mat-tab>

        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="mr-2">sync_alt</mat-icon>
            Données
          </ng-template>
          <div class="tab-content p-4">
            <pulpe-data-transfer />
          </div>
        </mat-tab>

        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="mr-2">notifications</mat-icon>
            Notifications
          </ng-template>
          <div class="tab-content p-4">
            <p class="text-gray-600 dark:text-gray-400">
              Les paramètres de notifications seront bientôt disponibles.
            </p>
          </div>
        </mat-tab>

        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="mr-2">security</mat-icon>
            Sécurité
          </ng-template>
          <div class="tab-content p-4">
            <p class="text-gray-600 dark:text-gray-400">
              Les paramètres de sécurité seront bientôt disponibles.
            </p>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [
    `
      .settings-container {
        min-height: calc(100vh - 64px);
      }

      .tab-content {
        min-height: 400px;
        animation: fadeIn 0.3s ease-in;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      ::ng-deep .mat-mdc-tab-body-wrapper {
        margin-top: 1rem;
      }

      ::ng-deep .mat-mdc-tab-labels {
        background: transparent;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {}
