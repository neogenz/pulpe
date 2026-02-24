import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DashboardMonthInsight } from './dashboard-month-insight';
import { setTestInput } from '../../../testing/signal-test-utils';

describe('DashboardMonthInsight', () => {
  let component: DashboardMonthInsight;
  let fixture: ComponentFixture<DashboardMonthInsight>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardMonthInsight],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardMonthInsight);
    component = fixture.componentInstance;
    setTestInput(component.timeElapsedPercentage, 50);
    setTestInput(component.remaining, 0);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('visibility', () => {
    it('should be hidden when timeElapsedPercentage <= 90', () => {
      setTestInput(component.timeElapsedPercentage, 50);
      setTestInput(component.remaining, 500);
      fixture.detectChanges();

      const content = fixture.debugElement.query(
        By.css('.bg-surface-container-low'),
      );
      expect(content).toBeFalsy();
    });

    it('should be visible when timeElapsedPercentage > 90', () => {
      setTestInput(component.timeElapsedPercentage, 95);
      setTestInput(component.remaining, 500);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain(
        'Ce mois se termine bien',
      );
    });
  });

  describe('insight types', () => {
    it('should show surplus message when remaining > 100', () => {
      setTestInput(component.timeElapsedPercentage, 95);
      setTestInput(component.remaining, 500);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain(
        'Ce mois se termine bien',
      );
    });

    it('should show balanced message when remaining is near zero', () => {
      setTestInput(component.timeElapsedPercentage, 95);
      setTestInput(component.remaining, 50);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain(
        'Pile poil dans le budget',
      );
    });

    it('should show slight deficit message', () => {
      setTestInput(component.timeElapsedPercentage, 95);
      setTestInput(component.remaining, -200);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('un peu serré');
    });

    it('should show deficit message', () => {
      setTestInput(component.timeElapsedPercentage, 95);
      setTestInput(component.remaining, -1000);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Mois compliqué');
    });
  });
});
