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
  isHostConditioned: boolean;
  directives: Map<string, Set<string>>;
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

function parseCspPolicy(
  cspValue: string,
  label: string,
  isHostConditioned: boolean,
): CspPolicy {
  const directives = new Map<string, Set<string>>();
  for (const rawDirective of cspValue.split(';')) {
    const directive = rawDirective.trim();
    if (!directive) continue;
    const [name = '', ...tokens] = directive.split(/\s+/);
    if (directives.has(name)) {
      throw new Error(
        `[csp-check] directive '${name}' is declared twice in the CSP entry for ${label} — browsers enforce only the first occurrence and ignore the rest; merge the duplicates.`,
      );
    }
    directives.set(
      name,
      new Set(tokens.map((token) => token.replace(/^'|'$/g, ''))),
    );
  }

  const tokensFor = (name: string): Set<string> =>
    directives.get(name) ?? new Set();

  for (const directive of SCRIPT_DIRECTIVES_TO_GUARD) {
    for (const forbidden of FORBIDDEN_SCRIPT_KEYWORDS) {
      if (tokensFor(directive).has(forbidden)) {
        throw new Error(
          `[csp-check] ${directive} contains '${forbidden}' in the CSP entry for ${label} — hash-only strict policy regressed (PUL-234).`,
        );
      }
    }
  }

  const hashesIn = (name: string): Set<string> =>
    new Set(
      [...tokensFor(name)].filter((token) => token.startsWith('sha256-')),
    );

  return {
    label,
    isHostConditioned,
    directives,
    scriptSrcElemHashes: hashesIn('script-src-elem'),
    scriptSrcAttrHashes: hashesIn('script-src-attr'),
  };
}

function assertHostConditionsMirror(blocks: VercelHeadersBlock[]): void {
  const patternsIn = (
    select: (block: VercelHeadersBlock) => VercelRouteCondition[] | undefined,
  ): Set<string> =>
    new Set(
      blocks
        .map((block) => hostPattern(select(block)))
        .filter((pattern): pattern is string => pattern !== undefined),
    );
  const hasPatterns = patternsIn((block) => block.has);
  const missingPatterns = patternsIn((block) => block.missing);
  const mirrored =
    hasPatterns.size === missingPatterns.size &&
    [...hasPatterns].every((pattern) => missingPatterns.has(pattern));
  if (!mirrored) {
    throw new Error(
      `[csp-check] the 'has' and 'missing' host patterns on the CSP entries must be identical (has: ${[...hasPatterns].join(', ') || 'none'} / missing: ${[...missingPatterns].join(', ') || 'none'}) — a host matching one pattern but not the other would be served with no Content-Security-Policy at all (PUL-236).`,
    );
  }
}

function readCspPolicies(): CspPolicy[] {
  const vercel = JSON.parse(
    readFileSync(VERCEL_JSON_PATH, 'utf-8'),
  ) as VercelJson;
  const cspBlocks = vercel.headers.filter((block) =>
    block.headers.some((header) => header.key === 'Content-Security-Policy'),
  );
  assertHostConditionsMirror(cspBlocks);
  const policies = cspBlocks.flatMap((block) =>
    block.headers
      .filter((header) => header.key === 'Content-Security-Policy')
      .map((header) =>
        parseCspPolicy(
          header.value,
          policyLabel(block),
          hostPattern(block.has) !== undefined,
        ),
      ),
  );
  if (policies.length === 0) {
    throw new Error('Content-Security-Policy header not found in vercel.json');
  }
  return policies;
}

function assertGrantsNothingBeyond(
  strict: CspPolicy,
  permissive: CspPolicy,
): void {
  const strictNames = [...strict.directives.keys()];
  const permissiveNames = [...permissive.directives.keys()];
  if (
    strictNames.length !== permissiveNames.length ||
    strictNames.some((name) => !permissive.directives.has(name))
  ) {
    throw new Error(
      `[csp-check] CSP entries declare different directive sets (${strict.label} vs ${permissive.label}) — keep both entries aligned directive-for-directive so the subset invariant stays decidable.`,
    );
  }
  for (const [name, strictTokens] of strict.directives) {
    const permissiveTokens = permissive.directives.get(name) ?? new Set();
    const extra = [...strictTokens].filter(
      (token) => !permissiveTokens.has(token),
    );
    if (extra.length > 0) {
      throw new Error(
        `[csp-check] ${name} for ${strict.label} grants source(s) absent from the policy for ${permissive.label}: ${extra.join(' ')}. The host-conditioned production CSP must only REMOVE sources relative to the fallback, so the worst-case policy Vercel can serve is the fallback (PUL-236).`,
      );
    }
  }
}

function assertProductionIsSubsetOfFallback(policies: CspPolicy[]): void {
  const strictPolicies = policies.filter((policy) => policy.isHostConditioned);
  const fallbackPolicies = policies.filter(
    (policy) => !policy.isHostConditioned,
  );
  if (strictPolicies.length === 0 || fallbackPolicies.length === 0) {
    throw new Error(
      `[csp-check] vercel.json must declare both a host-conditioned production CSP and a fallback CSP (found ${strictPolicies.length} host-conditioned, ${fallbackPolicies.length} fallback) — with either missing, the subset invariant is unverifiable (PUL-236).`,
    );
  }
  for (const strict of strictPolicies) {
    for (const fallback of fallbackPolicies) {
      assertGrantsNothingBeyond(strict, fallback);
    }
  }
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
assertProductionIsSubsetOfFallback(cspPolicies);
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
