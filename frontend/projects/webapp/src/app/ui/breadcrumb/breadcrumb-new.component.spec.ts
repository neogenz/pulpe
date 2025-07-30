import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { PulpeBreadcrumbNew } from './breadcrumb-new.component';
import { BreadcrumbItemDirective } from './breadcrumb-item.directive';
import { BreadcrumbSeparatorDirective } from './breadcrumb-separator.directive';
import { MatIconModule } from '@angular/material/icon';
import { NgTemplateOutlet } from '@angular/common';

@Component({
  template: `
    <pulpe-breadcrumb-new>
      <span *pulpeBreadcrumbItem>Home</span>
      <span *pulpeBreadcrumbItem>Products</span>
      <span *pulpeBreadcrumbItem>Electronics</span>
    </pulpe-breadcrumb-new>
  `,
  imports: [
    PulpeBreadcrumbNew,
    BreadcrumbItemDirective,
    MatIconModule,
    NgTemplateOutlet,
  ],
  standalone: true,
})
class TestHostComponent {}

@Component({
  template: `
    <pulpe-breadcrumb-new>
      <span *pulpeBreadcrumbItem>Home</span>
      <span *pulpeBreadcrumbItem>Products</span>
      <span *pulpeBreadcrumbSeparator>/</span>
    </pulpe-breadcrumb-new>
  `,
  imports: [
    PulpeBreadcrumbNew,
    BreadcrumbItemDirective,
    BreadcrumbSeparatorDirective,
    MatIconModule,
    NgTemplateOutlet,
  ],
  standalone: true,
})
class TestHostWithCustomSeparatorComponent {}

describe('PulpeBreadcrumbNew', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        TestHostComponent,
        TestHostWithCustomSeparatorComponent,
        NoopAnimationsModule,
        MatIconModule,
      ],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  describe('Basic functionality', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(TestHostComponent);
      fixture.detectChanges();
    });

    it('should create', () => {
      expect(fixture.componentInstance).toBeTruthy();
    });

    it('should render all breadcrumb items', () => {
      const items = fixture.nativeElement.querySelectorAll(
        'li:not([aria-hidden])',
      );
      expect(items.length).toBe(3);
      expect(items[0].textContent).toContain('Home');
      expect(items[1].textContent).toContain('Products');
      expect(items[2].textContent).toContain('Electronics');
    });

    it('should render default chevron separators between items', () => {
      const separators = fixture.nativeElement.querySelectorAll(
        'li[aria-hidden="true"] mat-icon',
      );
      expect(separators.length).toBe(2);
      separators.forEach((separator) => {
        expect(separator.textContent).toContain('chevron_right');
      });
    });

    it('should not render separator after last item', () => {
      const allItems = fixture.nativeElement.querySelectorAll('li');
      const lastItemIndex = allItems.length - 1;
      const lastItem = allItems[lastItemIndex];
      expect(lastItem.getAttribute('aria-hidden')).not.toBe('true');
    });

    it('should have proper navigation structure', () => {
      const nav = fixture.nativeElement.querySelector('nav');
      const ol = nav.querySelector('ol');

      expect(nav).toBeTruthy();
      expect(ol).toBeTruthy();
      expect(ol.classList.contains('flex')).toBeTruthy();
      expect(ol.classList.contains('list-none')).toBeTruthy();
    });

    it('should have default aria-label', () => {
      const nav = fixture.nativeElement.querySelector('nav');
      expect(nav.getAttribute('aria-label')).toBe('Breadcrumb');
    });
  });

  describe('Custom separator', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(TestHostWithCustomSeparatorComponent);
      fixture.detectChanges();
    });

    it('should render custom separator when provided', () => {
      const separators = fixture.nativeElement.querySelectorAll(
        'li[aria-hidden="true"]',
      );
      expect(separators.length).toBe(1);
      expect(separators[0].textContent).toContain('/');
    });

    it('should not render default chevron when custom separator is provided', () => {
      const chevrons = fixture.nativeElement.querySelectorAll(
        'li[aria-hidden="true"] mat-icon',
      );
      expect(chevrons.length).toBe(0);
    });
  });

  describe('Content projection', () => {
    it('should correctly project content through directives', () => {
      fixture = TestBed.createComponent(TestHostComponent);
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll(
        'li:not([aria-hidden]) span',
      );
      expect(items.length).toBe(3);
    });
  });
});
