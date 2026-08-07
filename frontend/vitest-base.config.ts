import { defineConfig } from 'vitest/config';

/**
 * Read by `@angular/build:unit-test` through the `runnerConfig` option of the
 * `test` target. Everything else — aliases, environment, setup files, coverage —
 * comes from the builder and from `angular.json`; this file exists for the one
 * knob the builder does not expose.
 *
 * Vitest defaults a test to 5 s. That was comfortable while the specs ran
 * through JIT, but they now compile ahead of time and instantiate components for
 * real, and `pnpm test:unit` runs four packages' suites at once. A spec that
 * rebuilds the TestBed around a heavy component then lands near the limit and
 * fails on timing rather than on behaviour.
 */
export default defineConfig({
  test: {
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
