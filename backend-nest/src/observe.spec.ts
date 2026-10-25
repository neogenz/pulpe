import { expect, test } from 'bun:test';

test('Observe sends useful diagnostics without the sensitive request values', async () => {
  // Isolate Nest instrumentation and the worker from other tests; only a local collector receives data.
  const process = Bun.spawn(
    [Bun.which('bun')!, 'src/test/fixtures/observe-privacy.fixture.ts'],
    {
      cwd: `${__dirname}/..`,
      stdout: 'pipe',
      stderr: 'pipe',
      signal: AbortSignal.timeout(10_000),
    },
  );
  const [stdout, stderr, status] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  expect(status, stderr).toBe(0);
  const payload = stdout.split('OBSERVE_TEST_PAYLOAD=')[1];
  expect(payload).toBeDefined();
  expect(payload).toContain('privacy/:id');
  expect(payload).toContain('Database write failed (23505)');
  expect(payload).toContain('PrivacyController');
  expect(payload).toContain('LibraryConsumerService');
  expect(payload).toContain('"sc":200');
  for (const provider of [
    'ConfigService',
    'ClsService',
    'FixtureConfigService',
    'FixtureClsService',
  ])
    expect(payload).not.toContain(provider);
  expect(payload).toContain('"m":"fail"');
  expect(payload).toContain('observe-privacy.fixture.ts:');
  expect(payload).not.toContain('http.url');
  expect(payload).toContain('"sc":500');
  expect(payload).toMatch(/"d":\d/);
  expect(payload).toContain('[REDACTED]');
  expect(payload).toContain('"cls":"Error"');
  expect(payload).not.toContain('codeFrames');
  for (const value of [
    'alice@example.invalid',
    '9876.54',
    '12345678-1234-1234-1234-123456789abc',
    'private-merchant',
    'private-filter',
    'private-user',
    'private-label',
    "'s budget",
    'abcdef12-1234-1234-1234-123456789abc',
    'private-query',
    'private-row',
    'private-body',
    'private-token',
    'private-path',
    'private-search',
    'private-request-id',
    'private-referrer',
    'private-bearer',
    'private-missing-path',
  ])
    expect(payload).not.toContain(value);
}, 15_000);
