import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

interface VercelHeader {
  key: string;
  value: string;
}

interface VercelHeadersBlock {
  source: string;
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
] as const;

function readCspDirectives(): {
  scriptSrcElemHashes: Set<string>;
  scriptSrcAttrHashes: Set<string>;
} {
  const vercel = JSON.parse(
    readFileSync(VERCEL_JSON_PATH, 'utf-8'),
  ) as VercelJson;
  const header = vercel.headers
    .flatMap((block) => block.headers)
    .find((h) => h.key === 'Content-Security-Policy');
  if (!header) {
    throw new Error('Content-Security-Policy header not found in vercel.json');
  }
  const directives = header.value.split(';').map((d) => d.trim());

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
          `[csp-check] ${directive} contains '${forbidden}' — hash-only strict policy regressed (PUL-234).`,
        );
      }
    }
  }

  const hashesIn = (prefix: string): Set<string> =>
    new Set(tokensFor(prefix).filter((token) => token.startsWith('sha256-')));

  return {
    scriptSrcElemHashes: hashesIn('script-src-elem'),
    scriptSrcAttrHashes: hashesIn('script-src-attr'),
  };
}

if (!existsSync(INDEX_PATH)) {
  console.error(`[csp-check] index.html not found at ${INDEX_PATH}`);
  process.exit(1);
}

const html = readFileSync(INDEX_PATH, 'utf-8');
const { document } = new JSDOM(html).window;

const { scriptSrcElemHashes, scriptSrcAttrHashes } = readCspDirectives();
const failures: string[] = [];

document.querySelectorAll('script').forEach((script, index) => {
  const hasSrc = !!script.getAttribute('src');
  const isJsonLd = script.getAttribute('type') === 'application/ld+json';
  const isImportMap = script.getAttribute('type') === 'importmap';
  const content = (script.textContent ?? '').trim();
  if (hasSrc || isJsonLd || isImportMap || !content) return;

  const hash = hashSource(content);
  if (scriptSrcElemHashes.has(hash)) return;
  const preview = content.replace(/\s+/g, ' ').slice(0, 80);
  failures.push(
    `inline <script> #${index} not allow-listed (hash ${hash}): ${preview}...`,
  );
});

document.querySelectorAll('*').forEach((element) => {
  for (const attr of Array.from(element.attributes)) {
    if (!attr.name.toLowerCase().startsWith('on')) continue;
    const value = attr.value;
    const hash = hashSource(value);
    if (scriptSrcAttrHashes.has(hash)) continue;
    failures.push(
      `inline handler ${attr.name}="${value}" on <${element.tagName.toLowerCase()}> not allow-listed (hash ${hash})`,
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
    '\nAdd the required hash to vercel.json CSP, or remove the inline source.',
  );
  process.exit(1);
}

console.log(
  `[csp-check] OK — every inline script/handler is allow-listed by CSP hash`,
);
