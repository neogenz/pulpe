import { test, expect } from '../../fixtures/test-fixtures';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface CspViolation {
  directive: string;
  blockedURI: string;
  sourceFile: string;
  line: number;
  sample: string;
}

declare global {
  interface Window {
    __cspViolations?: CspViolation[];
  }
}

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

const CRITICAL_ROUTES = ['/', '/login', '/welcome'] as const;
const VERCEL_JSON_PATH = join(__dirname, '../../../../vercel.json');

const LOCAL_BACKEND_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:4200',
  'ws://localhost:3000',
];

const VITE_DEV_PATH_FRAGMENTS = [
  '/.angular/cache/',
  '/vite/deps/',
  '/@vite/',
  '/@fs/',
];

function containsViteDevPath(value: string): boolean {
  return VITE_DEV_PATH_FRAGMENTS.some((fragment) => value.includes(fragment));
}

function isViteDevArtifact(violation: CspViolation): boolean {
  return (
    containsViteDevPath(violation.sourceFile) ||
    containsViteDevPath(violation.blockedURI)
  );
}

function readCspFromVercel(): string {
  const config = JSON.parse(readFileSync(VERCEL_JSON_PATH, 'utf-8')) as VercelJson;
  const header = config.headers
    .flatMap((block) => block.headers)
    .find((h) => h.key === 'Content-Security-Policy');
  if (!header) {
    throw new Error('Content-Security-Policy header not found in vercel.json');
  }
  return header.value;
}

function withLocalOrigins(csp: string): string {
  const extra = LOCAL_BACKEND_ORIGINS.join(' ');
  return csp.replace(
    /(connect-src [^;]+)/,
    (_, directive: string) => `${directive} ${extra}`,
  );
}

let cspValue: string;

test.describe('CSP — no violations on critical routes', () => {
  test.beforeAll(() => {
    cspValue = withLocalOrigins(readCspFromVercel());
  });

  test.beforeEach(async ({ page }) => {
    await page.route('**/*', async (route) => {
      if (route.request().resourceType() !== 'document') {
        await route.fallback();
        return;
      }
      const response = await route.fetch();
      const body = await response.body();
      await route.fulfill({
        response,
        body,
        headers: {
          ...response.headers(),
          'content-security-policy': cspValue,
        },
      });
    });
  });

  for (const route of CRITICAL_ROUTES) {
    test(`should emit zero CSP violations on ${route}`, async ({ page }) => {
      const consoleViolations: string[] = [];

      await page.addInitScript(() => {
        window.__cspViolations = [];
        document.addEventListener('securitypolicyviolation', (event) => {
          window.__cspViolations?.push({
            directive: event.violatedDirective,
            blockedURI: event.blockedURI,
            sourceFile: event.sourceFile,
            line: event.lineNumber,
            sample: event.sample,
          });
        });
      });

      page.on('console', (msg) => {
        const text = msg.text();
        const isCspError =
          text.includes('Content Security Policy') ||
          text.includes('Refused to execute') ||
          text.includes('Refused to evaluate') ||
          text.includes('Refused to load') ||
          text.includes('Refused to apply');
        if (isCspError && !containsViteDevPath(text)) {
          consoleViolations.push(text);
        }
      });

      await page.goto(route, { waitUntil: 'networkidle' });

      const eventViolations = (
        await page.evaluate(() => window.__cspViolations ?? [])
      ).filter((v) => !isViteDevArtifact(v));

      const allViolations = [...eventViolations, ...consoleViolations];

      expect(
        allViolations,
        `CSP violations on ${route}:\n${JSON.stringify(allViolations, null, 2)}`,
      ).toEqual([]);
    });
  }
});
