import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const NEXT_VERSION = "16.3.1";
const ORIGINAL =
  "getVaryHeader(e,t){let r=`${eq.hY}, ${eq.B}, ${eq._V}, ${eq.qm}`;return";
const PATCHED =
  "getVaryHeader(e,t){let r=`${eq.hY}, ${eq.B}, ${eq._V}, ${eq.qm}, Accept`;return";

export function patchVaryHeaderSource(source) {
  if (source.includes(PATCHED)) return source;

  assert.equal(
    source.split(ORIGINAL).length - 1,
    1,
    `Next ${NEXT_VERSION} Vary patch target changed`,
  );
  return source.replace(ORIGINAL, PATCHED);
}

export function patchInstalledNext() {
  const require = createRequire(import.meta.url);
  const packagePath = require.resolve("next/package.json");
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  assert.equal(packageJson.version, NEXT_VERSION, "Unsupported Next version");

  const runtimePath = join(
    dirname(packagePath),
    "dist/compiled/next-server/app-page.runtime.prod.js",
  );
  const source = readFileSync(runtimePath, "utf8");
  const patched = patchVaryHeaderSource(source);

  if (patched !== source) writeFileSync(runtimePath, patched);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) patchInstalledNext();
