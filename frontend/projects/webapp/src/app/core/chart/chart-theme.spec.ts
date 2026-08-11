import { describe, expect, it } from 'vitest';
import { Chart } from 'chart.js';
// Importing the module runs its top-level `Chart.register(...)` side-effect.
import './chart-theme';
import {
  formatAxisTick,
  formatCurrency,
  formatCurrencyForAria,
} from './chart-theme';

/**
 * Guards the tree-shaken Chart.js registration in chart-theme.ts. We register an
 * explicit set instead of `...registerables`; if a chart component starts using
 * a type/scale/plugin that isn't registered here, Chart.js fails silently at
 * runtime ("x is not a registered ..."). This asserts the registry contract at
 * runtime — no canvas needed, we only inspect `Chart.registry`.
 *
 * The registered set must cover everything the line + bar charts use:
 *   dashboard-history-chart (bar, with a line dataset mixed in),
 *   dashboard-future-projection-chart + goal-projection-chart (line, area fills).
 */
describe('chart-theme Chart.js registration', () => {
  it('registers every controller/scale/element/plugin the charts rely on', () => {
    expect(() => Chart.registry.getController('bar')).not.toThrow();
    expect(() => Chart.registry.getController('line')).not.toThrow();
    expect(() => Chart.registry.getScale('category')).not.toThrow();
    expect(() => Chart.registry.getScale('linear')).not.toThrow();
    expect(() => Chart.registry.getElement('bar')).not.toThrow();
    expect(() => Chart.registry.getElement('line')).not.toThrow();
    expect(() => Chart.registry.getElement('point')).not.toThrow();
    // Filler is load-bearing: both charts use fill:'origin'/true area fills.
    expect(() => Chart.registry.getPlugin('filler')).not.toThrow();
    expect(() => Chart.registry.getPlugin('legend')).not.toThrow();
    expect(() => Chart.registry.getPlugin('tooltip')).not.toThrow();
  });

  it('abbreviates by magnitude, so a negative axis keeps one unit', () => {
    expect(formatAxisTick(4000, 'CHF')).toBe('4k');
    expect(formatAxisTick(-4000, 'CHF')).toBe('-4k');
    expect(formatAxisTick(-500, 'CHF')).toBe('-500');
  });

  it('writes the abbreviated decimal with the currency locale separator', () => {
    expect(formatAxisTick(2500, 'EUR')).toBe('2,5k');
    expect(formatAxisTick(2500, 'CHF')).toBe('2.5k');
  });

  // Values stay under 1000 on purpose: the group separator glyph moves with the
  // environment's ICU, and none of these assertions is about grouping.
  it('names the currency by its ISO code in an aria label', () => {
    expect(formatCurrencyForAria(120.5, 'EUR')).toBe('120,50 EUR');
    expect(formatCurrencyForAria(120.5, 'CHF')).toBe('120.50 CHF');
  });

  it('leaves the visible label on the symbol, so only EUR readers hear a change', () => {
    expect(formatCurrency(120.5, 'EUR')).toBe('120,50 €');
    expect(formatCurrencyForAria(120.5, 'CHF')).toBe(
      formatCurrency(120.5, 'CHF'),
    );
  });

  // There is deliberately no "unused types stay unregistered" counterpart:
  // `Chart.registry` is a process-wide singleton, and two specs legitimately
  // call `provideCharts(withDefaultRegisterables())`, which registers every
  // type. Such an assertion would pass or fail on execution order, and it would
  // describe what the test process loaded rather than what ships — the app
  // bundle is what `chart-theme.ts` tree-shakes, and only a build can show it.
});
