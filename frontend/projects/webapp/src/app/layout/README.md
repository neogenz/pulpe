# Layout Architecture

The `layout/` directory contains eagerly-loaded application shell components that provide the structural framework for the application.

## What Belongs in Layout

### ✅ Include
- Main application shell
- Navigation components (header, sidebar, footer)
- Layout containers
- Route outlets wrappers
- Breadcrumbs
- Global notifications area

### ❌ Exclude
- Feature-specific content (use `feature/`)
- Reusable UI components (use `ui/` or `pattern/`)
- Business logic (use `core/`)
- Page content (use `feature/`)

## Folder Structure
```
layout/
├── shell/
│   └── shell.component.ts
├── header/
│   └── header.component.ts
├── sidebar/
│   └── sidebar.component.ts
├── footer/
│   └── footer.component.ts
└── breadcrumb/
    └── breadcrumb.component.ts
```

## Example Shell Implementation

```typescript
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    SidebarComponent,
    FooterComponent
  ],
  template: `
    <div class="app-shell">
      <app-header 
        [user]="currentUser()"
        (logout)="onLogout()">
      </app-header>
      
      <div class="app-body">
        <app-sidebar 
          [collapsed]="sidebarCollapsed()"
          (toggle)="toggleSidebar()">
        </app-sidebar>
        
        <main class="app-content">
          <router-outlet></router-outlet>
        </main>
      </div>
      
      <app-footer></app-footer>
    </div>
  `,
  styles: [`
    .app-shell {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    
    .app-body {
      display: flex;
      flex: 1;
    }
    
    .app-content {
      flex: 1;
      padding: 1rem;
      overflow-y: auto;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShellComponent {
  private readonly authService = inject(AuthService);
  
  protected readonly currentUser = this.authService.currentUser;
  protected readonly sidebarCollapsed = signal(false);
  
  protected toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }
  
  protected onLogout(): void {
    this.authService.logout();
  }
}
```

## Layout Loading Strategy

Layout components are eagerly loaded because:
- They're needed immediately on app start
- They provide the structural framework
- They rarely change after initial load
- They're lightweight (no heavy business logic)

## Integration with App Component

```typescript
// app.component.ts
@Component({
  selector: 'app-root',
  imports: [ShellComponent],
  template: `<app-shell></app-shell>`
})
export class AppComponent {}
```

## Navigation Configuration

Keep navigation configuration separate from components:

```typescript
// layout/navigation/navigation.config.ts
export interface NavItem {
  label: string;
  route: string;
  icon?: string;
  children?: NavItem[];
  roles?: string[];
}

export const navigationConfig: NavItem[] = [
  {
    label: 'Dashboard',
    route: '/dashboard',
    icon: 'pi pi-home'
  },
  {
    label: 'Profile',
    route: '/profile',
    icon: 'pi pi-user'
  }
];
```

## Responsive Layouts

Use CSS Grid and Flexbox for responsive layouts:

```typescript
@Component({
  template: `
    <div class="layout-container" [class.mobile]="isMobile()">
      <header class="layout-header">...</header>
      <nav class="layout-nav" [class.collapsed]="navCollapsed()">...</nav>
      <main class="layout-main">...</main>
    </div>
  `,
  styles: [`
    .layout-container {
      display: grid;
      grid-template-areas:
        "header header"
        "nav main";
      grid-template-columns: 250px 1fr;
    }
    
    .layout-container.mobile {
      grid-template-columns: 1fr;
    }
    
    .layout-nav.collapsed {
      width: 60px;
    }
  `]
})
```

## Best Practices

1. **Keep it lightweight**: No heavy computations or API calls
2. **Use signals**: For reactive state management
3. **Lazy load content**: Only the shell is eager, content is lazy
4. **Responsive first**: Design for mobile and scale up
5. **Accessibility**: Include ARIA labels and keyboard navigation