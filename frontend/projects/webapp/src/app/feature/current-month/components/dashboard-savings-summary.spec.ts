import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DashboardSavingsSummary } from './dashboard-savings-summary';
import { setTestInput } from '../../../testing/signal-test-utils';
import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';

registerLocaleData(localeDE);

describe('DashboardSavingsSummary', () => {
  let component: DashboardSavingsSummary;
  let fixture: ComponentFixture<DashboardSavingsSummary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardSavingsSummary],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardSavingsSummary);
    component = fixture.componentInstance;
    setTestInput(component.totalPlanned, 0);
    setTestInput(component.totalRealized, 0);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('when savings are planned', () => {
    beforeEach(() => {
      setTestInput(component.totalPlanned, 500);
      setTestInput(component.totalRealized, 200);
      fixture.detectChanges();
    });

    it('should show progress bar', () => {
      const progressBar = fixture.debugElement.query(
        By.css('.bg-primary.rounded-full'),
      );
      expect(progressBar).toBeTruthy();
    });

    it('should display correct progress percentage (40%)', () => {
      expect(fixture.nativeElement.textContent).toContain('40%');
    });

    it('should show contextual message with amounts', () => {
      expect(fixture.nativeElement.textContent).toContain('Tu as mis de côté');
    });
  });

  describe('when no savings planned', () => {
    beforeEach(() => {
      setTestInput(component.totalPlanned, 0);
      setTestInput(component.totalRealized, 0);
      fixture.detectChanges();
    });

    it('should show empty state message', () => {
      expect(fixture.nativeElement.textContent).toContain(
        "Pas d'épargne prévue ce mois",
      );
    });

    it('should not show progress bar', () => {
      const progressBar = fixture.debugElement.query(
        By.css('.bg-primary.rounded-full'),
      );
      expect(progressBar).toBeFalsy();
    });
  });

  describe('progressPercentage', () => {
    it('should cap at 100 when realized exceeds planned', () => {
      setTestInput(component.totalPlanned, 100);
      setTestInput(component.totalRealized, 150);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('100%');
    });

    it('should return 0% when planned is 0 but realized exists', () => {
      setTestInput(component.totalPlanned, 0);
      setTestInput(component.totalRealized, 50);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('0%');
      expect(fixture.nativeElement.textContent).toContain('Tu as mis de côté');
    });
  });

  describe('when no planned but realized savings exist', () => {
    it('should show savings UI instead of empty state', () => {
      setTestInput(component.totalPlanned, 0);
      setTestInput(component.totalRealized, 100);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain(
        "Pas d'épargne prévue ce mois",
      );
      expect(fixture.nativeElement.textContent).toContain('Tu as mis de côté');
    });
  });
});
