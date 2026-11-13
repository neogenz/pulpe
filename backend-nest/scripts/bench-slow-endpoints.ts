/**
 * Measures the slow write endpoints against the local stack, with and without a
 * simulated Supabase network latency, to tell whether a fix removes round trips.
 *
 *   bun --env-file=.env.local scripts/bench-slow-endpoints.ts [iterations] [latencies]
 *   e.g. bun --env-file=.env.local scripts/bench-slow-endpoints.ts 3 0,300
 *
 * Needs local Supabase running. Spawns its own API on BENCH_PORT (default 3099)
 * once per latency, so a running dev server is left alone. Each iteration starts
 * from a fresh demo user, so runs do not depend on each other.
 *
 * "serial RT" = (median at L ms − median at 0 ms) / L: the number of Supabase
 * calls the request waits on one after another. That count is what production
 * latency multiplies, and what a round-trip fix must lower. A large L (300 ms)
 * keeps that signal above the noise of a loaded machine.
 */
import { type ChildProcess, spawn } from 'node:child_process';

const PORT = Number(process.env.BENCH_PORT ?? 3099);
const BASE = `http://127.0.0.1:${PORT}`;
const API = `${BASE}/api/v1`;
const DEMO_CLIENT_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const iterations = Number(process.argv[2] ?? 3);
const latencies = (process.argv[3] ?? '0,300').split(',').map(Number);

type Step =
  | 'demo/session'
  | 'budgets/generate'
  | 'spread (existing months)'
  | 'spread (creates months)';
const STEPS: Step[] = [
  'demo/session',
  'budgets/generate',
  'spread (existing months)',
  'spread (creates months)',
];

// Demo seeds months -6..+5 around today; generate fills +6..+17, the second
// spread lands on +18..+29 where no budget exists yet (provisioning path).
const monthsFrom = (offset: number, count: number) =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset + i);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  });

async function call<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ ms: number; json: T }> {
  const start = performance.now();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token && {
        authorization: `Bearer ${token}`,
        'x-client-key': DEMO_CLIENT_KEY,
      }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as T;
  const ms = performance.now() - start;
  if (!res.ok) {
    throw new Error(
      `${method} ${path} → ${res.status} ${JSON.stringify(json)}`,
    );
  }
  return { ms, json };
}

async function runIteration(): Promise<Record<Step, number>> {
  const demo = await call<{ data: { session: { access_token: string } } }>(
    'POST',
    '/demo/session',
    { turnstileToken: '' },
  );
  const token = demo.json.data.session.access_token;

  const templates = await call<{
    data: { id: string; isDefault: boolean }[];
  }>('GET', '/budget-templates', undefined, token);
  const template = templates.json.data.find((t) => t.isDefault);
  if (!template) throw new Error('Demo user has no default template');
  const [start] = monthsFrom(6, 1);

  const generate = await call(
    'POST',
    '/budgets/generate',
    {
      templateId: template.id,
      startMonth: start.month,
      startYear: start.year,
      count: 12,
    },
    token,
  );
  const spreadBody = (offset: number) => ({
    name: 'Bench spread',
    kind: 'expense',
    mode: 'perMonth',
    perMonthAmount: 10,
    months: monthsFrom(offset, 12),
  });
  const spreadExisting = await call(
    'POST',
    '/budget-lines/spread',
    spreadBody(6),
    token,
  );
  const spreadCreating = await call(
    'POST',
    '/budget-lines/spread',
    spreadBody(18),
    token,
  );

  return {
    'demo/session': demo.ms,
    'budgets/generate': generate.ms,
    'spread (existing months)': spreadExisting.ms,
    'spread (creates months)': spreadCreating.ms,
  };
}

async function waitForHealth(
  server: ChildProcess,
  timeoutMs = 60_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('API exited during startup');
    try {
      if ((await fetch(`${BASE}/health`)).ok) return;
    } catch {
      // not listening yet
    }
    await Bun.sleep(500);
  }
  throw new Error(`API did not become healthy on ${BASE}`);
}

async function measureAtLatency(
  latencyMs: number,
): Promise<Record<Step, number>> {
  let serverLog = '';
  const server = spawn('bun', ['src/main.ts'], {
    env: {
      ...process.env,
      NODE_ENV: 'development', // as `bun run dev` sets it
      PORT: String(PORT),
      SUPABASE_SIMULATED_LATENCY_MS: String(latencyMs),
      DELAY_MS: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const keepTail = (chunk: Buffer) => {
    serverLog = (serverLog + chunk.toString()).slice(-4000);
  };
  server.stdout.on('data', keepTail);
  server.stderr.on('data', keepTail);

  try {
    await waitForHealth(server);
    await runIteration(); // warm-up: JIT, connection pools, DEK cache
    const samples: Record<Step, number>[] = [];
    for (let i = 0; i < iterations; i++) samples.push(await runIteration());
    return Object.fromEntries(
      STEPS.map((step) => [step, median(samples.map((s) => s[step]))]),
    ) as Record<Step, number>;
  } catch (error) {
    console.error(
      `--- API log tail (latency ${latencyMs} ms) ---\n${serverLog}`,
    );
    throw error;
  } finally {
    server.kill();
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const results = new Map<number, Record<Step, number>>();
for (const latency of latencies) {
  console.log(`Measuring at ${latency} ms simulated latency…`);
  results.set(latency, await measureAtLatency(latency));
}

const baseline = results.get(0);
console.log(`\nMedian of ${iterations} runs (ms)`);
console.table(
  Object.fromEntries(
    STEPS.map((step) => {
      const row: Record<string, number> = {};
      for (const [latency, medians] of results) {
        row[`${latency} ms`] = Math.round(medians[step]);
        if (baseline && latency > 0) {
          row[`serial RT @${latency}`] =
            Math.round(((medians[step] - baseline[step]) / latency) * 10) / 10;
        }
      }
      return [step, row];
    }),
  ),
);
