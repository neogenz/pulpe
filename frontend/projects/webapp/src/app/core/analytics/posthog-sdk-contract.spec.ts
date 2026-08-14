import { afterEach, describe, expect, it } from 'vitest';
import {
  PostHog,
  type CaptureResult,
} from 'posthog-js/dist/module.full.no-external';
import { sanitizeEventPayload } from './posthog-sanitizer';

const SAFE_PRODUCT_TEXT = 'Open budget details';
const PRIVATE_SENTINEL = 'PRIVATE_FINANCIAL_TEXT_938475';
const REQUEST_ID = '7ba2f8b6-9c66-49b7-aa13-f9d62980a002';
const POSTHOG_TOKEN = 'phc_sdk_contract_test';
const testWindow = window as Window & {
  _POSTHOG_REMOTE_CONFIG?: Record<
    string,
    {
      config: {
        hasFeatureFlags: boolean;
        sessionRecording: { sampleRate: string };
      };
      siteApps: never[];
    }
  >;
};

describe('PostHog SDK replay contract', () => {
  let posthog: PostHog | undefined;
  let fixture: HTMLElement | undefined;

  afterEach(() => {
    posthog?.stopSessionRecording();
    posthog?.reset(true);
    fixture?.remove();
    Reflect.deleteProperty(testWindow, '_POSTHOG_REMOTE_CONFIG');
  });

  it('keeps a real rrweb snapshot usable without leaking masked content', () => {
    const rawSnapshots: string[] = [];
    const sanitizedSnapshots: CaptureResult[] = [];
    const sanitizedExceptions: CaptureResult[] = [];

    fixture = document.createElement('section');
    const text = document.createElement('p');
    const input = document.createElement('input');
    const blocked = document.createElement('strong');
    text.textContent = SAFE_PRODUCT_TEXT;
    input.value = PRIVATE_SENTINEL;
    blocked.className = 'ph-no-capture';
    blocked.textContent = PRIVATE_SENTINEL;
    fixture.append(text, input, blocked);
    document.body.append(fixture);

    // Emulate array.js remote config so the real recorder starts without I/O.
    testWindow._POSTHOG_REMOTE_CONFIG = {
      [POSTHOG_TOKEN]: {
        config: {
          hasFeatureFlags: false,
          sessionRecording: { sampleRate: '1' },
        },
        siteApps: [],
      },
    };

    posthog = new PostHog();
    posthog.init(POSTHOG_TOKEN, {
      api_host: 'https://posthog.invalid',
      persistence: 'memory',
      capture_pageview: false,
      capture_pageleave: false,
      autocapture: false,
      capture_heatmaps: false,
      capture_dead_clicks: false,
      capture_exceptions: false,
      disable_surveys: true,
      disable_product_tours: true,
      disable_conversations: true,
      strict_script_versioning: true,
      session_recording: {
        maskAllInputs: true,
        // Expose rrweb output to the assertions; production uses SDK compression.
        compress_events: false,
      },
      before_send: [
        (event) => {
          if (event?.event === '$snapshot') {
            rawSnapshots.push(JSON.stringify(event));
          }
          return event;
        },
        sanitizeEventPayload,
        (event) => {
          if (event?.event === '$snapshot') {
            sanitizedSnapshots.push(event);
          } else if (event?.event === '$exception') {
            sanitizedExceptions.push(event);
          }
          return null;
        },
      ],
    });

    posthog.startSessionRecording(true);
    text.textContent = `${SAFE_PRODUCT_TEXT} updated`;
    posthog.captureException(new Error(PRIVATE_SENTINEL), {
      request_id: REQUEST_ID,
      httpStatus: 500,
      backendErrorCode: 'BUDGET_LOAD_FAILED',
      planned_amount: 42_000,
    });
    expect(posthog.sessionRecordingStarted()).toBe(true);
    posthog.stopSessionRecording();

    expect(rawSnapshots.length).toBeGreaterThan(0);
    expect(sanitizedSnapshots.length).toBeGreaterThan(0);
    const sanitizedFullSnapshot = sanitizedSnapshots.find((snapshot) => {
      const replay = snapshot.properties?.['$snapshot_data'];
      return (
        Array.isArray(replay) &&
        replay.some(
          (event: unknown) =>
            typeof event === 'object' &&
            event !== null &&
            (event as Record<string, unknown>)['type'] === 2,
        )
      );
    });
    const rawFullSnapshot = rawSnapshots.find((serializedSnapshot) => {
      const snapshot = JSON.parse(serializedSnapshot) as CaptureResult;
      const replay = snapshot.properties?.['$snapshot_data'];
      return (
        Array.isArray(replay) &&
        replay.some(
          (event: unknown) =>
            typeof event === 'object' &&
            event !== null &&
            (event as Record<string, unknown>)['type'] === 2,
        )
      );
    });

    expect(sanitizedFullSnapshot).toBeDefined();
    expect(rawFullSnapshot).toBeDefined();
    expect(JSON.stringify(sanitizedFullSnapshot)).toBe(rawFullSnapshot);
    const replayEvents = (JSON.parse(rawFullSnapshot!) as CaptureResult)
      .properties?.['$snapshot_data'] as Record<string, unknown>[];
    const fullSnapshot = replayEvents.find((event) => event['type'] === 2);
    const nodes = [
      (fullSnapshot?.['data'] as Record<string, unknown>)?.['node'],
    ];
    let blockedNode: Record<string, unknown> | undefined;
    while (nodes.length > 0 && !blockedNode) {
      const node = nodes.pop();
      if (typeof node !== 'object' || node === null) continue;
      const record = node as Record<string, unknown>;
      const attributes = record['attributes'] as
        | Record<string, unknown>
        | undefined;
      if (attributes?.['class'] === 'ph-no-capture') blockedNode = record;
      if (Array.isArray(record['childNodes']))
        nodes.push(...record['childNodes']);
    }

    expect(blockedNode?.['childNodes']).toEqual([]);
    expect(rawSnapshots.join()).toContain(SAFE_PRODUCT_TEXT);
    expect(rawSnapshots.join()).not.toContain(PRIVATE_SENTINEL);
    expect(JSON.stringify(sanitizedSnapshots)).not.toContain(PRIVATE_SENTINEL);

    expect(sanitizedExceptions).toHaveLength(1);
    const exception = sanitizedExceptions[0];
    const snapshotSessionId =
      sanitizedFullSnapshot?.properties?.['$session_id'];
    expect(snapshotSessionId).toEqual(expect.any(String));
    expect(exception.properties).toMatchObject({
      $session_id: snapshotSessionId,
      request_id: REQUEST_ID,
      httpStatus: 500,
      backendErrorCode: 'BUDGET_LOAD_FAILED',
    });
    expect(exception.properties).not.toHaveProperty('planned_amount');
    expect(JSON.stringify(exception)).not.toContain(PRIVATE_SENTINEL);
  });
});
