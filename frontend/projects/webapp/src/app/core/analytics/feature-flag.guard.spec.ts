import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type CanMatchFn,
  Router,
  type Route,
  type UrlSegment,
  type UrlTree,
} from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { featureFlagGuard } from './feature-flag.guard';
import { PostHogService } from './posthog';

describe('featureFlagGuard', () => {
  const dashboard = { toString: () => '/dashboard' } as UrlTree;
  const flagsVersion = signal(0);
  let enabled: boolean;

  const run = () =>
    TestBed.runInInjectionContext(() =>
      featureFlagGuard('net_worth')(
        {} as Route,
        [] as UrlSegment[],
        {} as Parameters<CanMatchFn>[2],
      ),
    );

  beforeEach(() => {
    enabled = false;
    flagsVersion.set(0);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PostHogService,
          useValue: {
            isFeatureEnabled: () => enabled,
            flagsVersion,
            isEnabled: () => true,
          },
        },
        { provide: Router, useValue: { createUrlTree: () => dashboard } },
      ],
    });
  });

  it('should open the route when the flag is on', async () => {
    enabled = true;
    expect(await run()).toBe(true);
  });

  it('should redirect to the dashboard when resolved flags leave it off', async () => {
    flagsVersion.set(1);
    expect(await run()).toBe(dashboard);
  });

  it('should wait for the flags on a deep link, then open the route', async () => {
    const result = run();
    enabled = true;
    flagsVersion.set(1);
    TestBed.tick();
    expect(await result).toBe(true);
  });

  it('should give up after a delay when the flags never resolve', async () => {
    vi.useFakeTimers();
    const result = run();
    await vi.advanceTimersByTimeAsync(3000);
    expect(await result).toBe(dashboard);
    vi.useRealTimers();
  });
});
