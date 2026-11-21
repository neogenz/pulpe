import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ANALYTICS_EVENTS } from 'pulpe-shared';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { PostHogService } from '@core/analytics/posthog';
import { UserSettingsStore } from '@core/user-settings';
import { ReconcileGuide } from './reconcile-guide';
import {
  GUIDE_GAP,
  GUIDE_SCENES,
  guideAction,
  type GuideOutcome,
  type GuideSource,
} from './reconcile-guide.model';

function setup(source: GuideSource = 'auto') {
  const postHog = { captureEvent: vi.fn() };
  TestBed.configureTestingModule({
    imports: [ReconcileGuide],
    providers: [
      provideZonelessChangeDetection(),
      ...provideTranslocoForTest(),
      { provide: PostHogService, useValue: postHog },
      { provide: UserSettingsStore, useValue: { currency: signal('CHF') } },
    ],
  });
  const fixture = TestBed.createComponent(ReconcileGuide);
  fixture.componentRef.setInput('source', source);
  const finished: GuideOutcome[] = [];
  fixture.componentInstance.finished.subscribe((outcome) =>
    finished.push(outcome),
  );
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const byTestId = <T extends HTMLElement = HTMLElement>(id: string) =>
    host.querySelector<T>(`[data-testid="${id}"]`);
  const click = async (id: string) => {
    byTestId(id)?.click();
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const endEvents = () =>
    postHog.captureEvent.mock.calls.filter(
      ([name]) =>
        name === ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_COMPLETED ||
        name === ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_SKIPPED,
    );
  return { fixture, host, postHog, finished, byTestId, click, endEvents };
}

const text = (element: HTMLElement | null) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();

describe('ReconcileGuide', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('should list the three scenes and the sample gap of the spec', () => {
    expect(GUIDE_SCENES).toHaveLength(3);
    expect(GUIDE_GAP).toBe(60);
    expect(guideAction(0)).toBe('next');
    expect(guideAction(1)).toBe('next');
    expect(guideAction(2)).toBe('start');
  });

  it('should walk the three scenes, each with its title and sentence, the drawing hidden', async () => {
    const view = setup();
    const expected = [
      [
        'Vérifie que Pulpe et ta banque disent la même chose',
        'Suivant',
        'Étape 1 sur 3',
      ],
      ['Tape ce que ta banque affiche', 'Suivant', 'Étape 2 sur 3'],
      ['Pulpe te montre ce qui manque', 'Comparer maintenant', 'Étape 3 sur 3'],
    ];

    for (const [index, [title, primary, dots]] of expected.entries()) {
      expect(text(view.host.querySelector('h2'))).toBe(title);
      expect(view.host.querySelector('p.sentence')?.textContent?.trim()).toBe(
        [
          'Tu évites les mauvaises surprises : si un montant manque, Pulpe te le montre.',
          "Ouvre l'app de ta banque et recopie le montant de ton compte.",
          "Coche l'essence de 60 : Pulpe est à jour avec ta banque.",
        ][index],
      );
      expect(
        view.byTestId('reconcile-guide-scene')?.getAttribute('aria-hidden'),
      ).toBe('true');
      expect(text(view.byTestId('reconcile-guide-primary'))).toBe(primary);
      expect(
        view.byTestId('reconcile-guide-dots')?.getAttribute('aria-label'),
      ).toBe(dots);
      if (index < 2) await view.click('reconcile-guide-primary');
    }
  });

  it('should focus the title on open, with the sentence as its description', async () => {
    const view = setup();
    await view.fixture.whenStable();

    const title = view.byTestId('reconcile-guide-title');
    expect(document.activeElement).toBe(title);
    expect(title?.getAttribute('aria-describedby')).toBe(
      view.host.querySelector('p.sentence')?.id,
    );
  });

  it('should show the sample figures and the gap on scene 1', () => {
    const scene = text(setup().byTestId('reconcile-guide-scene'));

    expect(scene).toContain('890.00');
    expect(scene).toContain('950.00');
    expect(scene).toContain('60 de différence');
  });

  it('should open with the source and end once as completed on « Comparer maintenant »', async () => {
    const view = setup('help');
    await view.click('reconcile-guide-primary');
    await view.click('reconcile-guide-primary');

    await view.click('reconcile-guide-primary');
    view.fixture.destroy();

    expect(view.postHog.captureEvent).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_VIEWED,
      { source: 'help' },
    );
    expect(view.endEvents()).toEqual([
      [
        ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_COMPLETED,
        { source: 'help' },
      ],
    ]);
    expect(view.finished).toEqual(['completed']);
  });

  it('should end once as skipped on « Passer », from any scene', async () => {
    const view = setup();
    await view.click('reconcile-guide-primary');

    await view.click('reconcile-guide-skip');
    view.fixture.destroy();

    expect(view.endEvents()).toEqual([
      [
        ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_SKIPPED,
        { source: 'auto' },
      ],
    ]);
    expect(view.finished).toEqual(['skipped']);
  });

  it('should count a close from outside (Escape, backdrop) as skipped', () => {
    const view = setup();

    view.fixture.destroy();

    expect(view.endEvents()).toEqual([
      [
        ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_SKIPPED,
        { source: 'auto' },
      ],
    ]);
    expect(view.finished).toEqual([]);
  });
});
