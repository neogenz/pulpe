import { describe, expect, it } from 'vitest';
import { Chart } from 'chart.js';
// Importing the module runs its top-level `Chart.register(...)` side-effect.
import './chart-theme';

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

  it('does not register unused chart types (tree-shaking left them out)', () => {
    expect(() => Chart.registry.getController('doughnut')).toThrow();
    expect(() => Chart.registry.getScale('radialLinear')).toThrow();
  });
});
