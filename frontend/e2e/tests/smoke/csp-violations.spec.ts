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

const CRITICAL_ROUTES = ['/', '/login', '/welcome'] as const;
const VERCEL_JSON_PATH = join(__dirname, '../../../../vercel.json');
const PRODUCTION_HOST = 'app.pulpe.app';

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

function hasProductionHostCondition(block: VercelHeadersBlock): boolean {
  return (block.has ?? []).some(
    (condition) =>
      condition.type === 'host' &&
      condition.value !== undefined &&
      new RegExp(`^(?:${condition.value})$`).test(PRODUCTION_HOST),
  );
}

function readProductionCspFromVercel(): string {
  const config = JSON.parse(
    readFileSync(VERCEL_JSON_PATH, 'utf-8'),
  ) as VercelJson;
  const cspHeaders = config.headers
    .filter(hasProductionHostCondition)
    .flatMap((block) => block.headers)
    .filter((header) => header.key === 'Content-Security-Policy');
  const cspHeader = cspHeaders[0];
  if (!cspHeader) {
    throw new Error(
      `No Content-Security-Policy entry conditioned on host ${PRODUCTION_HOST} found in vercel.json — the production CSP cannot be tested.`,
    );
  }
  if (cspHeaders.length > 1) {
    throw new Error(
      `Multiple Content-Security-Policy entries match host ${PRODUCTION_HOST} in vercel.json — merge them so the tested production policy is unambiguous.`,
    );
  }
  return cspHeader.value;
}

function withLocalOrigins(csp: string): string {
  const extra = LOCAL_BACKEND_ORIGINS.join(' ');
  const pattern = /(connect-src [^;]+)/;
  if (!pattern.test(csp)) {
    throw new Error(
      'connect-src directive not found in vercel.json CSP — cannot inject local backend origins for e2e.',
    );
  }
  return csp.replace(
    pattern,
    (_, directive: string) => `${directive} ${extra}`,
  );
}

let cspValue: string;

test.describe('CSP — no violations on critical routes', () => {
  test.beforeAll(() => {
    cspValue = withLocalOrigins(readProductionCspFromVercel());
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

      await page.goto(route, { waitUntil: 'networkidle' });

      const violations = (
        await page.evaluate(() => window.__cspViolations ?? [])
      ).filter((v) => !isViteDevArtifact(v));

      expect(
        violations,
        `CSP violations on ${route}:\n${JSON.stringify(violations, null, 2)}`,
      ).toEqual([]);
    });
  }
});
