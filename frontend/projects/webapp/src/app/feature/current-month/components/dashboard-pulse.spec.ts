import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DashboardPulse } from './dashboard-pulse';
import { setTestInput } from '../../../testing/signal-test-utils';

describe('DashboardPulse', () => {
  let component: DashboardPulse;
  let fixture: ComponentFixture<DashboardPulse>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPulse],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPulse);
    component = fixture.componentInstance;
    setTestInput(component.budgetConsumedPercentage, 0);
    setTestInput(component.timeElapsedPercentage, 0);
    setTestInput(component.checkedForecastCount, 0);
    setTestInput(component.totalForecastCount, 0);
    setTestInput(component.nextMonthHasBudget, false);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render 3 indicator dots', () => {
    fixture.detectChanges();
    const dots = fixture.debugElement.queryAll(By.css('.rounded-full'));
    expect(dots.length).toBe(3);
  });

  describe('pace indicator', () => {
    it('should be good when consumption is on track', () => {
      setTestInput(component.budgetConsumedPercentage, 40);
      setTestInput(component.timeElapsedPercentage, 50);
      fixture.detectChanges();

      const dots = fixture.debugElement.queryAll(By.css('.rounded-full'));
      expect(dots[0].nativeElement.classList).toContain('bg-primary');
    });

    it('should be warning when consumption exceeds pace', () => {
      setTestInput(component.budgetConsumedPercentage, 70);
      setTestInput(component.timeElapsedPercentage, 50);
      fixture.detectChanges();

      const dots = fixture.debugElement.queryAll(By.css('.rounded-full'));
      expect(dots[0].nativeElement.classList).toContain('bg-amber-500');
    });
  });

  describe('coverage indicator', () => {
    it('should be good when >= 70% checked', () => {
      setTestInput(component.checkedForecastCount, 7);
      setTestInput(component.totalForecastCount, 10);
      fixture.detectChanges();

      const dots = fixture.debugElement.queryAll(By.css('.rounded-full'));
      expect(dots[1].nativeElement.classList).toContain('bg-primary');
    });

    it('should be warning when < 70% checked', () => {
      setTestInput(component.checkedForecastCount, 3);
      setTestInput(component.totalForecastCount, 10);
      fixture.detectChanges();

      const dots = fixture.debugElement.queryAll(By.css('.rounded-full'));
      expect(dots[1].nativeElement.classList).toContain('bg-amber-500');
    });

    it('should be neutral when no forecasts', () => {
      setTestInput(component.checkedForecastCount, 0);
      setTestInput(component.totalForecastCount, 0);
      fixture.detectChanges();

      const dots = fixture.debugElement.queryAll(By.css('.rounded-full'));
      expect(dots[1].nativeElement.classList).toContain('bg-outline-variant');
    });
  });

  describe('planning indicator', () => {
    it('should be good when next month has budget', () => {
      setTestInput(component.nextMonthHasBudget, true);
      fixture.detectChanges();

      const dots = fixture.debugElement.queryAll(By.css('.rounded-full'));
      expect(dots[2].nativeElement.classList).toContain('bg-primary');
    });

    it('should be neutral when next month has no budget', () => {
      setTestInput(component.nextMonthHasBudget, false);
      fixture.detectChanges();

      const dots = fixture.debugElement.queryAll(By.css('.rounded-full'));
      expect(dots[2].nativeElement.classList).toContain('bg-outline-variant');
    });
  });
});
