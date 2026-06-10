import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

interface VercelRouteCondition {
  type: 'host' | 'header' | 'cookie' | 'query';
  key?: string;
  value?: string;
}

interface VercelHeader {
  key: string;
  value: string;
}

interface VercelHeadersBlock {
  source: string;
  has?: VercelRouteCondition[];
  missing?: VercelRouteCondition[];
  headers: VercelHeader[];
}

interface VercelJson {
  headers: VercelHeadersBlock[];
}

const REPO_ROOT = join(process.cwd(), '..');
const INDEX_PATH = join(
  process.cwd(),
  'dist',
  'webapp',
  'browser',
  'index.html',
);
const VERCEL_JSON_PATH = join(REPO_ROOT, 'vercel.json');

function hashSource(source: string): string {
  return `sha256-${createHash('sha256').update(source).digest('base64')}`;
}

const FORBIDDEN_SCRIPT_KEYWORDS = ['unsafe-inline', 'unsafe-eval'] as const;
const SCRIPT_DIRECTIVES_TO_GUARD = [
  'script-src',
  'script-src-elem',
  'script-src-attr',
] as const;

interface CspPolicy {
  label: string;
  scriptSrcElemHashes: Set<string>;
  scriptSrcAttrHashes: Set<string>;
}

function hostPattern(
  conditions: VercelRouteCondition[] | undefined,
): string | undefined {
  return conditions?.find((condition) => condition.type === 'host')?.value;
}

function policyLabel(block: VercelHeadersBlock): string {
  const hasHost = hostPattern(block.has);
  if (hasHost) return `hosts matching ${hasHost}`;
  const missingHost = hostPattern(block.missing);
  if (missingHost) return `hosts NOT matching ${missingHost}`;
  return 'all hosts';
}

function parseCspPolicy(cspValue: string, label: string): CspPolicy {
  const directives = cspValue.split(';').map((d) => d.trim());

  const tokensFor = (prefix: string): string[] => {
    const matching = directives.find((d) => d.startsWith(`${prefix} `));
    if (!matching) return [];
    return matching
      .split(/\s+/)
      .slice(1)
      .map((token) => token.replace(/^'|'$/g, ''));
  };

  for (const directive of SCRIPT_DIRECTIVES_TO_GUARD) {
    const tokens = tokensFor(directive);
    for (const forbidden of FORBIDDEN_SCRIPT_KEYWORDS) {
      if (tokens.includes(forbidden)) {
        throw new Error(
          `[csp-check] ${directive} contains '${forbidden}' in the CSP entry for ${label} — hash-only strict policy regressed (PUL-234).`,
        );
      }
    }
  }

  const hashesIn = (prefix: string): Set<string> =>
    new Set(tokensFor(prefix).filter((token) => token.startsWith('sha256-')));

  return {
    label,
    scriptSrcElemHashes: hashesIn('script-src-elem'),
    scriptSrcAttrHashes: hashesIn('script-src-attr'),
  };
}

function readCspPolicies(): CspPolicy[] {
  const vercel = JSON.parse(
    readFileSync(VERCEL_JSON_PATH, 'utf-8'),
  ) as VercelJson;
  const policies = vercel.headers.flatMap((block) =>
    block.headers
      .filter((header) => header.key === 'Content-Security-Policy')
      .map((header) => parseCspPolicy(header.value, policyLabel(block))),
  );
  if (policies.length === 0) {
    throw new Error('Content-Security-Policy header not found in vercel.json');
  }
  return policies;
}

function rejectingLabels(
  policies: CspPolicy[],
  selectHashes: (policy: CspPolicy) => Set<string>,
  hash: string,
): string[] {
  return policies
    .filter((policy) => !selectHashes(policy).has(hash))
    .map((policy) => policy.label);
}

if (!existsSync(INDEX_PATH)) {
  console.error(`[csp-check] index.html not found at ${INDEX_PATH}`);
  process.exit(1);
}

const html = readFileSync(INDEX_PATH, 'utf-8');
const { document } = new JSDOM(html).window;

const cspPolicies = readCspPolicies();
const failures: string[] = [];

document.querySelectorAll('script').forEach((script, index) => {
  const hasSrc = !!script.getAttribute('src');
  const isJsonLd = script.getAttribute('type') === 'application/ld+json';
  const isImportMap = script.getAttribute('type') === 'importmap';
  const content = (script.textContent ?? '').trim();
  if (hasSrc || isJsonLd || isImportMap || !content) return;

  const hash = hashSource(content);
  const rejecting = rejectingLabels(
    cspPolicies,
    (policy) => policy.scriptSrcElemHashes,
    hash,
  );
  if (rejecting.length === 0) return;
  const preview = content.replace(/\s+/g, ' ').slice(0, 80);
  failures.push(
    `inline <script> #${index} (hash ${hash}) not allow-listed by the CSP for: ${rejecting.join('; ')}: ${preview}...`,
  );
});

document.querySelectorAll('*').forEach((element) => {
  for (const attr of Array.from(element.attributes)) {
    if (!attr.name.toLowerCase().startsWith('on')) continue;
    const value = attr.value;
    const hash = hashSource(value);
    const rejecting = rejectingLabels(
      cspPolicies,
      (policy) => policy.scriptSrcAttrHashes,
      hash,
    );
    if (rejecting.length === 0) continue;
    failures.push(
      `inline handler ${attr.name}="${value}" on <${element.tagName.toLowerCase()}> (hash ${hash}) not allow-listed by the CSP for: ${rejecting.join('; ')}`,
    );
  }
});

document
  .querySelectorAll('[href^="javascript:" i], [src^="javascript:" i]')
  .forEach((element) => {
    failures.push(`javascript: URI on <${element.tagName.toLowerCase()}>`);
  });

if (failures.length) {
  console.error('[csp-check] FAILED:');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(
    '\nAdd the required hash to every CSP entry in vercel.json, or remove the inline source.',
  );
  process.exit(1);
}

console.log(
  `[csp-check] OK — every inline script/handler is allow-listed by all ${cspPolicies.length} CSP policies`,
);
