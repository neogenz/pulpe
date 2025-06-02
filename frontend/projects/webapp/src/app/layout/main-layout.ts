import { TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'pulpe-main-layout',
  imports: [MatToolbarModule, MatButtonModule, RouterModule, TitleCasePipe],
  template: `
    <mat-toolbar class="fixed shadow-lg !bg-white">
      <div class="container mx-auto px-10">
        <div class="flex justify-between">
          <a href="https://pulpe.ch" target="_blank" class="hidden md:inline">
            <img
              height="60"
              width="168"
              src="https://via.placeholder.com/168x60/007ACC/FFFFFF?text=PULPE"
              alt="Pulpe Logo"
            />
          </a>
          <a href="https://pulpe.ch" target="_blank" class="md:hidden">
            <img
              height="48"
              width="48"
              src="https://via.placeholder.com/48x48/007ACC/FFFFFF?text=P"
              alt="Pulpe Logo"
            />
          </a>

          <div class="flex items-center gap-4">
            @for (route of ['home']; track $index) {
              <!-- add more routes here -->
              <a
                [routerLink]="['/app', route]"
                routerLinkActive
                #rla="routerLinkActive"
                [color]="rla.isActive ? 'accent' : 'primary'"
                mat-flat-button
              >
                {{ route | titlecase }}
              </a>
            }
          </div>
        </div>
      </div>
    </mat-toolbar>

    <main class="container mx-auto mt-16 p-10">
      <router-outlet />
    </main>

    <footer class="mt-auto p-10 bg-white">
      <div class="container mx-auto text-center">Pulpe</div>
    </footer>
  `,
  styles: [
    `
      @reference 'tailwindcss';
      :host {
        @apply flex flex-col min-h-screen bg-gray-100;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayout {}
