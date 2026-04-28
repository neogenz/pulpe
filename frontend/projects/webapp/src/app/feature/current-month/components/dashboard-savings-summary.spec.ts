import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DashboardSavingsSummary } from './dashboard-savings-summary';
import { setTestInput } from '../../../testing/signal-test-utils';
import { provideTranslocoForTest } from '../../../testing/transloco-testing';
import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';

registerLocaleData(localeDE);

describe('DashboardSavingsSummary', () => {
  let component: DashboardSavingsSummary;
  let fixture: ComponentFixture<DashboardSavingsSummary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardSavingsSummary],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardSavingsSummary);
    component = fixture.componentInstance;
    setTestInput(component.totalPlanned, 0);
    setTestInput(component.totalRealized, 0);
    setTestInput(component.checkedCount, 0);
    setTestInput(component.totalCount, 0);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('when savings are in progress', () => {
    beforeEach(() => {
      setTestInput(component.totalPlanned, 500);
      setTestInput(component.totalRealized, 200);
      setTestInput(component.checkedCount, 1);
      setTestInput(component.totalCount, 3);
      fixture.detectChanges();
    });

    it('should show progress bar', () => {
      const progressBar = fixture.debugElement.query(
        By.css('[role="progressbar"]'),
      );
      expect(progressBar).toBeTruthy();
    });

    it('should set progress bar aria-valuenow to 40', () => {
      const progressBar = fixture.debugElement.query(
        By.css('[role="progressbar"]'),
      );
      expect(progressBar.attributes['aria-valuenow']).toBe('40');
    });

    it('should show contextual message with amounts', () => {
      expect(fixture.nativeElement.textContent).toContain('Tu as mis de côté');
    });

    it('should show checked count subtitle', () => {
      expect(fixture.nativeElement.textContent).toContain(
        '1 sur 3 mises de côté',
      );
    });

    it('should render CHF aggregation amounts as integers (entiers, no decimals)', () => {
      setTestInput(component.totalRealized, 200.5);
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('201');
      expect(text).toContain('500');
      expect(text).not.toMatch(/\d[.,]\d{2}/);
    });
  });

  describe('when no savings planned', () => {
    beforeEach(() => {
      setTestInput(component.totalPlanned, 0);
      setTestInput(component.totalRealized, 0);
      setTestInput(component.checkedCount, 0);
      setTestInput(component.totalCount, 0);
      fixture.detectChanges();
    });

    it('should show empty state message', () => {
      expect(fixture.nativeElement.textContent).toContain(
        "Pas d'épargne prévue ce mois",
      );
    });

    it('should not show progress bar', () => {
      const progressBar = fixture.debugElement.query(
        By.css('[role="progressbar"]'),
      );
      expect(progressBar).toBeFalsy();
    });

    it('should show "Aucune prévision" subtitle', () => {
      expect(fixture.nativeElement.textContent).toContain('Aucune prévision');
    });
  });

  describe('progressPercentage', () => {
    it('should show complete state when realized exceeds planned', () => {
      setTestInput(component.totalPlanned, 100);
      setTestInput(component.totalRealized, 150);
      setTestInput(component.checkedCount, 2);
      setTestInput(component.totalCount, 2);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        "C'est fait pour ce mois",
      );
    });

    it('should show in-progress state when planned is 0 but realized exists', () => {
      setTestInput(component.totalPlanned, 0);
      setTestInput(component.totalRealized, 50);
      setTestInput(component.checkedCount, 1);
      setTestInput(component.totalCount, 1);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Tu as mis de côté');
    });
  });

  describe('when no planned but realized savings exist', () => {
    it('should show savings UI instead of empty state', () => {
      setTestInput(component.totalPlanned, 0);
      setTestInput(component.totalRealized, 100);
      setTestInput(component.checkedCount, 1);
      setTestInput(component.totalCount, 1);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain(
        "Pas d'épargne prévue ce mois",
      );
      expect(fixture.nativeElement.textContent).toContain('Tu as mis de côté');
    });
  });

  describe('when all savings are complete (100%)', () => {
    beforeEach(() => {
      setTestInput(component.totalPlanned, 500);
      setTestInput(component.totalRealized, 500);
      setTestInput(component.checkedCount, 3);
      setTestInput(component.totalCount, 3);
      fixture.detectChanges();
    });

    it('should show completion message', () => {
      expect(fixture.nativeElement.textContent).toContain(
        "C'est fait pour ce mois",
      );
    });

    it('should show relief message', () => {
      expect(fixture.nativeElement.textContent).toContain(
        'Toute ton épargne est en place. Tu peux souffler.',
      );
    });

    it('should show "Tout est en place" subtitle', () => {
      expect(fixture.nativeElement.textContent).toContain('Tout est en place');
    });

    it('should not show progress bar', () => {
      const progressBar = fixture.debugElement.query(
        By.css('[role="progressbar"]'),
      );
      expect(progressBar).toBeFalsy();
    });

    it('should show check_circle icon', () => {
      const icon = fixture.debugElement.query(By.css('mat-icon.scale-150'));
      expect(icon).toBeTruthy();
      expect(icon.nativeElement.textContent.trim()).toBe('check_circle');
    });
  });
});
