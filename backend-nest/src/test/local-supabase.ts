import { execSync } from 'node:child_process';
import { delimiter, resolve } from 'node:path';

const BACKEND_ROOT = resolve(__dirname, '../..');

export type SupabaseEnv = {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

const LOCAL_SUPABASE_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

export const IS_DEDICATED_INTEGRATION_RUN =
  process.env.RUN_INTEGRATION_TESTS === 'true';

function stripNodeModulesBin(
  pathValue: string | undefined,
): string | undefined {
  if (!pathValue) return pathValue;
  return pathValue
    .split(delimiter)
    .filter((segment) => !segment.includes('node_modules/.bin'))
    .join(delimiter);
}

function resolveSupabaseCliPath(): string {
  if (process.env.SUPABASE_CLI_PATH) {
    return process.env.SUPABASE_CLI_PATH;
  }

  const env = { ...process.env, PATH: stripNodeModulesBin(process.env.PATH) };

  try {
    const resolved = execSync('command -v supabase', {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .toString()
      .trim();
    return resolved || 'supabase';
  } catch {
    return 'supabase';
  }
}

function runSupabase(command: string): string {
  const env = { ...process.env };
  delete env.SUPABASE_ACCESS_TOKEN;
  delete env.SUPABASE_PROJECT_REF;
  delete env.SUPABASE_PROJECT_ID;

  env.PATH = stripNodeModulesBin(env.PATH);
  const cliPath = resolveSupabaseCliPath();
  const cli = cliPath.includes(' ')
    ? `"${cliPath.replace(/"/g, '\\"')}"`
    : cliPath;

  return execSync(`${cli} --workdir "${BACKEND_ROOT}" ${command}`, {
    cwd: BACKEND_ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).toString();
}

function parseSupabaseStatus(raw: string): SupabaseEnv {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Supabase status output missing JSON payload');
  }
  const status = JSON.parse(raw.slice(start, end + 1)) as Record<
    string,
    string
  >;

  const apiUrl =
    status.api_url ?? status.API_URL ?? status.apiUrl ?? status.ApiUrl;
  // Newer local stacks may only expose the sb_publishable_/sb_secret_ key
  // pair (PUBLISHABLE_KEY/SECRET_KEY) instead of the legacy JWT keys.
  const anonKey =
    status.anon_key ??
    status.ANON_KEY ??
    status.anonKey ??
    status.AnonKey ??
    status.PUBLISHABLE_KEY ??
    status.publishable_key;
  const serviceRoleKey =
    status.service_role_key ??
    status.SERVICE_ROLE_KEY ??
    status.serviceRoleKey ??
    status.ServiceRoleKey ??
    status.SECRET_KEY ??
    status.secret_key;

  if (!apiUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      `Supabase status missing keys. Got: ${Object.keys(status).join(', ')}`,
    );
  }

  return { apiUrl, anonKey, serviceRoleKey };
}

function tryGetSupabaseEnv(): SupabaseEnv | null {
  try {
    const raw = runSupabase('status --output json');
    return parseSupabaseStatus(raw);
  } catch {
    return null;
  }
}

function isLocalSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return LOCAL_SUPABASE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function getSupabaseEnvFromProcess(): SupabaseEnv | null {
  const apiUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiUrl || !anonKey || !serviceRoleKey) return null;
  if (!isLocalSupabaseUrl(apiUrl)) return null;

  return { apiUrl, anonKey, serviceRoleKey };
}

const REACHABILITY_ATTEMPTS = 3;
const REACHABILITY_TIMEOUT_MS = 5000;
const REACHABILITY_RETRY_DELAY_MS = 2000;

async function probeSupabaseAuthHealth(apiUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REACHABILITY_TIMEOUT_MS);
  try {
    const response = await fetch(new URL('/auth/v1/health', apiUrl), {
      signal: controller.signal,
    });
    return response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function isSupabaseApiReachable(apiUrl: string): Promise<boolean> {
  for (let attempt = 1; attempt <= REACHABILITY_ATTEMPTS; attempt++) {
    if (await probeSupabaseAuthHealth(apiUrl)) return true;
    if (attempt < REACHABILITY_ATTEMPTS) {
      await new Promise((resolve) =>
        setTimeout(resolve, REACHABILITY_RETRY_DELAY_MS),
      );
    }
  }
  return false;
}

export async function ensureSupabaseAvailable(): Promise<SupabaseEnv> {
  // The CLI is the source of truth for the running stack, locally and in the
  // dedicated CI job alike — `bun test` auto-loads .env.local, whose keys can
  // be stale or placeholders, so process env only serves as a fallback. Never
  // gate that fallback on key format (JWT alg, sb_ prefixes): CLI 2.84.2
  // issues plain HS256 demo JWTs that work fine — an ES256-only gate is what
  // forced every CI run onto the flaky execSync path in the first place.
  const statusEnv = tryGetSupabaseEnv();
  if (
    statusEnv &&
    isLocalSupabaseUrl(statusEnv.apiUrl) &&
    (await isSupabaseApiReachable(statusEnv.apiUrl))
  ) {
    return statusEnv;
  }

  const envFromProcess = getSupabaseEnvFromProcess();
  if (envFromProcess && (await isSupabaseApiReachable(envFromProcess.apiUrl))) {
    return envFromProcess;
  }

  throw new Error(
    'Supabase local is not reachable. Start it with `supabase start` from backend-nest.',
  );
}
