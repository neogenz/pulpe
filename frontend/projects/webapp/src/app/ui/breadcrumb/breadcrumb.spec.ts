import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { MatIconModule } from '@angular/material/icon';
import { PulpeBreadcrumb, BreadcrumbItemViewModel } from './breadcrumb';

@Component({
  template: `<pulpe-breadcrumb [items]="items" />`,
  imports: [PulpeBreadcrumb],
  standalone: true,
})
class TestHostComponent {
  items: BreadcrumbItemViewModel[] = [];
}

describe('PulpeBreadcrumb', () => {
  let component: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        TestHostComponent,
        NoopAnimationsModule,
        RouterTestingModule,
        MatIconModule,
      ],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    const breadcrumb = fixture.nativeElement.querySelector('pulpe-breadcrumb');
    expect(breadcrumb).toBeTruthy();
  });

  describe('Rendering', () => {
    it('should not render when less than 2 items', () => {
      component.items = [{ label: 'Home', url: '/' }];
      fixture.detectChanges();

      const nav = fixture.nativeElement.querySelector('nav');
      expect(nav).toBeNull();
    });

    it('should render when 2 or more items', () => {
      component.items = [
        { label: 'Home', url: '/' },
        { label: 'Products', url: '/products' },
      ];
      fixture.detectChanges();

      const nav = fixture.nativeElement.querySelector('pulpe-breadcrumb-new');
      expect(nav).toBeTruthy();
    });

    it('should render all items except last as links', () => {
      component.items = [
        { label: 'Home', url: '/' },
        { label: 'Products', url: '/products' },
        { label: 'Electronics', url: '/products/electronics' },
      ];
      fixture.detectChanges();

      const links = fixture.nativeElement.querySelectorAll('a[mat-button]');
      const spans = fixture.nativeElement.querySelectorAll(
        'span[class*="font-medium"]',
      );

      expect(links.length).toBe(2);
      expect(spans.length).toBe(1);
      expect(links[0].textContent).toContain('Home');
      expect(links[1].textContent).toContain('Products');
      expect(spans[0].textContent).toContain('Electronics');
    });

    it('should render icons when provided', () => {
      component.items = [
        { label: 'Home', url: '/', icon: 'home' },
        { label: 'Settings', url: '/settings', icon: 'settings' },
      ];
      fixture.detectChanges();

      const icons = fixture.nativeElement.querySelectorAll('mat-icon');
      expect(icons.length).toBeGreaterThanOrEqual(2);
      expect(icons[0].textContent).toContain('home');
      expect(icons[1].textContent).toContain('settings');
    });

    it('should apply correct styles to links', () => {
      component.items = [
        { label: 'Home', url: '/' },
        { label: 'Products', url: '/products' },
      ];
      fixture.detectChanges();

      const link = fixture.nativeElement.querySelector('a[mat-button]');
      expect(link.classList.contains('text-on-surface-variant')).toBeTruthy();
      expect(link.classList.contains('hover:text-primary')).toBeTruthy();
    });

    it('should apply correct styles to last item', () => {
      component.items = [
        { label: 'Home', url: '/' },
        { label: 'Current Page', url: '/current' },
      ];
      fixture.detectChanges();

      const span = fixture.nativeElement.querySelector(
        'span[class*="font-medium"]',
      );
      expect(span.classList.contains('text-on-surface')).toBeTruthy();
      expect(span.classList.contains('font-medium')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label on nav element', () => {
      component.items = [
        { label: 'Home', url: '/' },
        { label: 'Products', url: '/products' },
      ];
      fixture.detectChanges();

      const nav = fixture.nativeElement.querySelector('nav');
      expect(nav).toBeTruthy();
      expect(nav.getAttribute('aria-label')).toBe('Breadcrumb');
    });
  });
});
