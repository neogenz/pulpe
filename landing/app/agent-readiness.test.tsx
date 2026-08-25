import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import proxy from "../proxy";
import { homeMetadata } from "../components/pages/metadata";
import { patchVaryHeaderSource } from "../scripts/patch-next-vary.js";

const VARY = "Accept, Accept-Encoding";
const rootDocumentSource = readFileSync(
  new URL("../components/RootDocument.tsx", import.meta.url),
  "utf8",
);
const markdown = readFileSync(
  new URL("../public/index.md", import.meta.url),
  "utf8",
);
const llms = readFileSync(
  new URL("../public/llms.txt", import.meta.url),
  "utf8",
);
const nextPackage = JSON.parse(
  readFileSync(
    new URL("../node_modules/next/package.json", import.meta.url),
    "utf8",
  ),
);
const nextAppPageRuntime = readFileSync(
  new URL(
    "../node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js",
    import.meta.url,
  ),
  "utf8",
);

function request(path: string, accept?: string) {
  return new NextRequest(`https://pulpe.app${path}`, {
    headers: accept === undefined ? undefined : { accept },
  });
}

describe("agent representation negotiation", () => {
  it("keeps HTML as the default and advertises the cache key", () => {
    for (const accept of [undefined, "*/*", "text/markdown;q=0, text/html"]) {
      const response = proxy(request("/", accept));
      assert.equal(response.headers.get("x-middleware-next"), "1");
      assert.equal(response.headers.get("vary"), VARY);
    }
  });

  it("rewrites the homepage when Markdown is preferred", () => {
    for (const accept of [
      "text/markdown",
      "text/markdown, text/html",
      "text/html;q=0.2, text/markdown;q=0.8",
    ]) {
      const response = proxy(request("/", accept));
      assert.equal(
        response.headers.get("x-middleware-rewrite"),
        "https://pulpe.app/index.md",
      );
      assert.equal(
        response.headers.get("content-type"),
        "text/markdown; charset=utf-8",
      );
      assert.equal(response.headers.get("vary"), VARY);
    }
  });

  it("falls back to HTML only when the requested route can serve it", () => {
    const fallback = proxy(
      request("/de/support", "text/markdown, text/html;q=0.5"),
    );
    assert.equal(fallback.headers.get("x-middleware-next"), "1");
    assert.equal(fallback.headers.get("vary"), VARY);

    const rejected = proxy(request("/de/support", "text/markdown"));
    assert.equal(rejected.status, 406);
    assert.equal(rejected.headers.get("vary"), VARY);

    const unsupported = proxy(request("/", "application/json"));
    assert.equal(unsupported.status, 406);
    assert.equal(unsupported.headers.get("vary"), VARY);
  });
});

describe("agent discovery files", () => {
  it("publishes useful plain Markdown for the homepage", () => {
    assert.match(markdown, /^# Pulpe$/m);
    assert.ok(markdown.replace(/\s+/g, " ").trim().length > 500);
    assert.doesNotMatch(markdown, /<[^>]+>/);
    assert.doesNotMatch(markdown, /\bAPI\b/i);
  });

  it("keeps llms.txt in the required v2 order", () => {
    const lines = llms.split("\n");
    assert.equal(lines[0], "# Pulpe");
    assert.match(
      lines.find((line) => line.length > 0 && line !== "# Pulpe")!,
      /^> /,
    );
    assert.equal(lines.filter((line) => /^# /.test(line)).length, 1);

    const sectionIndexes = lines.flatMap((line, index) =>
      /^## /.test(line) ? [index] : [],
    );
    assert.deepEqual(
      sectionIndexes.map((index) => lines[index]),
      ["## When to use Pulpe", "## Main pages", "## Additional resources"],
    );

    for (const [position, start] of sectionIndexes.entries()) {
      const end = sectionIndexes[position + 1] ?? lines.length;
      const entries = lines.slice(start + 1, end).filter(Boolean);
      assert.ok(entries.length > 0);
      for (const entry of entries) {
        assert.match(entry, /^- \[[^\]]+\]\(https:\/\/[^)]+\): .+$/);
      }
    }

    assert.match(llms, /Il n’existe pas d’API publique pour les agents/);
  });

  it("links the HTML homepage to its agent resources", async () => {
    const metadata = await homeMetadata("fr");
    assert.equal(metadata.alternates?.types?.["text/markdown"], "/index.md");
    assert.match(
      rootDocumentSource,
      /<link rel="describedby" href="\/llms\.txt" \/>/,
    );
  });

  it("patches the exact final Vary header imposed by Next", () => {
    assert.equal(nextPackage.version, "16.3.1");

    const patched = patchVaryHeaderSource(nextAppPageRuntime);
    assert.match(patched, /getVaryHeader\(e,t\).*?qm}, Accept`/);
    assert.equal(patchVaryHeaderSource(patched), patched);
    assert.throws(
      () => patchVaryHeaderSource("unexpected runtime"),
      /Vary patch target changed/,
    );
  });
});
