import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';
import { SpreadPill } from './spread-pill';

describe('SpreadPill (PUL-17 Lot B)', () => {
  let fixture: ComponentFixture<SpreadPill>;
  let component: SpreadPill;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpreadPill],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SpreadPill);
    component = fixture.componentInstance;
    setTestInput(
      component.spreadGroupId,
      '11111111-1111-1111-1111-111111111111',
    );
    fixture.detectChanges();
  });

  it('should render a real button with the "Lissé" pill', () => {
    const button: HTMLButtonElement | null =
      fixture.nativeElement.querySelector('button');

    expect(button).not.toBeNull();
    expect(button!.textContent).toContain('Lissé');
  });

  it('should use the date_range icon and NEVER the repeat icon', () => {
    const icon: HTMLElement | null =
      fixture.nativeElement.querySelector('mat-icon');

    expect(icon!.textContent?.trim()).toBe('date_range');
    expect(fixture.nativeElement.textContent).not.toContain('repeat');
  });

  it('should emit openOccurrences with the group id and stop propagation on click', () => {
    const spy = vi.fn();
    component.openOccurrences.subscribe(spy);
    const event = new MouseEvent('click', { bubbles: true });
    const stopSpy = vi.spyOn(event, 'stopPropagation');

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector('button');
    button.dispatchEvent(event);

    expect(stopSpy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111');
  });
});
