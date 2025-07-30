import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PulpeBreadcrumbNew } from './breadcrumb-new.component';
import { BreadcrumbItemDirective } from './breadcrumb-item.directive';
import { BreadcrumbSeparatorDirective } from './breadcrumb-separator.directive';

/**
 * Example 1: Basic breadcrumb with links
 */
@Component({
  selector: 'pulpe-breadcrumb-example-basic',
  template: `
    <pulpe-breadcrumb-new aria-label="Navigation breadcrumb">
      <a mat-button *pulpeBreadcrumbItem routerLink="/home">Home</a>
      <a mat-button *pulpeBreadcrumbItem routerLink="/products">Products</a>
      <a mat-button *pulpeBreadcrumbItem routerLink="/products/electronics">
        Electronics
      </a>
      <span *pulpeBreadcrumbItem class="font-medium">Smartphones</span>
    </pulpe-breadcrumb-new>
  `,
  imports: [
    PulpeBreadcrumbNew,
    BreadcrumbItemDirective,
    MatButtonModule,
    RouterLink,
  ],
})
export class BreadcrumbBasicExample {}

/**
 * Example 2: Breadcrumb with icons
 */
@Component({
  selector: 'pulpe-breadcrumb-example-icons',
  template: `
    <pulpe-breadcrumb-new>
      <a mat-button *pulpeBreadcrumbItem routerLink="/dashboard">
        <mat-icon class="mr-1">dashboard</mat-icon>
        Dashboard
      </a>
      <a mat-button *pulpeBreadcrumbItem routerLink="/budgets">
        <mat-icon class="mr-1">account_balance</mat-icon>
        Budgets
      </a>
      <span *pulpeBreadcrumbItem class="flex items-center font-medium">
        <mat-icon class="mr-1">add</mat-icon>
        Create New Budget
      </span>
    </pulpe-breadcrumb-new>
  `,
  imports: [
    PulpeBreadcrumbNew,
    BreadcrumbItemDirective,
    MatButtonModule,
    MatIconModule,
    RouterLink,
  ],
})
export class BreadcrumbWithIconsExample {}

/**
 * Example 3: Custom separator
 */
@Component({
  selector: 'pulpe-breadcrumb-example-custom-separator',
  template: `
    <pulpe-breadcrumb-new>
      <a mat-button *pulpeBreadcrumbItem routerLink="/home">Home</a>
      <a mat-button *pulpeBreadcrumbItem routerLink="/docs">Documentation</a>
      <a mat-button *pulpeBreadcrumbItem routerLink="/docs/guides">Guides</a>
      <span *pulpeBreadcrumbItem class="font-medium">Getting Started</span>

      <span *pulpeBreadcrumbSeparator class="mx-2 text-outline">/</span>
    </pulpe-breadcrumb-new>
  `,
  imports: [
    PulpeBreadcrumbNew,
    BreadcrumbItemDirective,
    BreadcrumbSeparatorDirective,
    MatButtonModule,
    RouterLink,
  ],
})
export class BreadcrumbCustomSeparatorExample {}

/**
 * Example 4: Complex breadcrumb with dynamic content
 */
@Component({
  selector: 'pulpe-breadcrumb-example-dynamic',
  template: `
    <pulpe-breadcrumb-new>
      <a mat-button *pulpeBreadcrumbItem routerLink="/users">
        <mat-icon class="mr-1">group</mat-icon>
        Users
      </a>
      <a mat-button *pulpeBreadcrumbItem [routerLink]="['/users', userId]">
        {{ userName }}
      </a>
      <span *pulpeBreadcrumbItem class="flex items-center font-medium">
        <mat-icon class="mr-1">edit</mat-icon>
        Edit Profile
      </span>

      <!-- Custom separator with icon -->
      <mat-icon *pulpeBreadcrumbSeparator class="text-outline mx-1">
        arrow_forward_ios
      </mat-icon>
    </pulpe-breadcrumb-new>
  `,
  imports: [
    PulpeBreadcrumbNew,
    BreadcrumbItemDirective,
    BreadcrumbSeparatorDirective,
    MatButtonModule,
    MatIconModule,
    RouterLink,
  ],
})
export class BreadcrumbDynamicExample {
  userId = '123';
  userName = 'John Doe';
}

/**
 * Example 5: Breadcrumb with custom styling
 */
@Component({
  selector: 'pulpe-breadcrumb-example-custom-style',
  template: `
    <pulpe-breadcrumb-new>
      <a
        *pulpeBreadcrumbItem
        routerLink="/home"
        class="px-3 py-1 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors"
      >
        Home
      </a>
      <a
        *pulpeBreadcrumbItem
        routerLink="/settings"
        class="px-3 py-1 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors"
      >
        Settings
      </a>
      <span
        *pulpeBreadcrumbItem
        class="px-3 py-1 rounded-full bg-primary text-on-primary font-medium"
      >
        Appearance
      </span>
    </pulpe-breadcrumb-new>
  `,
  imports: [PulpeBreadcrumbNew, BreadcrumbItemDirective, RouterLink],
})
export class BreadcrumbCustomStyleExample {}
