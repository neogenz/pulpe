import { TestBed } from '@angular/core/testing';
import { StateCard } from './state-card';

describe('StateCard', () => {
  it('keeps empty states quiet while preserving action, loading and error feedback', async () => {
    const fixture = TestBed.createComponent(StateCard);
    fixture.componentRef.setInput('variant', 'empty');
    fixture.componentRef.setInput('title', 'Pas encore de prévisions');
    fixture.componentRef.setInput('message', 'Commence par ton prochain mois.');
    fixture.componentRef.setInput('actionLabel', 'Préparer un budget');
    const action = vi.fn();
    fixture.componentInstance.action.subscribe(action);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('mat-card, mat-icon')).toBeNull();
    expect(root.querySelector('h2')?.textContent).toBe(
      'Pas encore de prévisions',
    );
    root.querySelector('button')!.click();
    expect(action).toHaveBeenCalledOnce();

    fixture.componentRef.setInput('compact', true);
    fixture.componentRef.setInput('actionDisabled', true);
    await fixture.whenStable();
    expect(root.querySelector('h3')?.textContent).toBe(
      'Pas encore de prévisions',
    );
    expect(root.querySelector('button')!.disabled).toBe(true);

    fixture.componentRef.setInput('variant', 'loading');
    await fixture.whenStable();
    expect(root.querySelector('mat-progress-spinner')).not.toBeNull();
    fixture.componentRef.setInput('variant', 'error');
    await fixture.whenStable();
    expect(root.querySelector('mat-progress-spinner')).toBeNull();
    expect(root.querySelector('mat-icon')?.textContent).toBe('error_outline');
  });
});
