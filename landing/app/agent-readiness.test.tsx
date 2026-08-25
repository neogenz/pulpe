import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it, mock } from "node:test";
import { NextRequest } from "next/server";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import proxy from "../proxy";
import sitemap from "./sitemap";
import fr from "../content/dictionaries/fr";
import { homeMetadata } from "../components/pages/metadata";
import { ABOUT_ROUTE, PRIVACY_ROUTE, SITE_URL } from "../lib/routes";
import { patchVaryHeaderSource } from "../scripts/patch-next-vary.js";

const nextFontMock = {
  cache: false,
  exports: { Poppins: () => ({ variable: "font-poppins" }) },
};
mock.module("next/font/google", nextFontMock);

const nextImageMock = {
  cache: false,
  exports: {
    default: (props: Record<string, unknown>) =>
      React.createElement("img", { src: props.src, alt: props.alt }),
  },
};
mock.module("next/image", nextImageMock);

const { buildJsonLd } = await import("../components/RootDocument");

const { default: AboutPage, generateMetadata: aboutMetadata } =
  await import("./(fr)/about/page");
const { default: PrivacyPage, generateMetadata: privacyMetadata } =
  await import("./(fr)/privacy/page");
const { default: LandingPage } = await import("./(fr)/page");

const VARY = "Accept, Accept-Encoding";
const rootDocumentSource = readFileSync(
  new URL("../components/RootDocument.tsx", import.meta.url),
  "utf8",
);
const nextConfigSource = readFileSync(
  new URL("../next.config.ts", import.meta.url),
  "utf8",
);
const deploymentIgnore = readFileSync(
  new URL("../../.vercelignore", import.meta.url),
  "utf8",
);
const landingPackage = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const notFoundSource = readFileSync(
  new URL("./global-not-found.tsx", import.meta.url),
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

function request(path: string, accept?: string, method = "GET") {
  return new NextRequest(`https://pulpe.app${path}`, {
    method,
    headers: accept === undefined ? undefined : { accept },
  });
}

function visibleText(markup: string) {
  return markup
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function assertTrustPage(markup: string) {
  assert.equal(markup.match(/<h1\b/g)?.length, 1);
  assert.ok(visibleText(markup).length > 500);

  const levels = [...markup.matchAll(/<h([1-6])\b/g)].map((match) =>
    Number(match[1]),
  );
  assert.equal(levels[0], 1);
  for (let index = 1; index < levels.length; index += 1) {
    assert.ok(levels[index] - levels[index - 1] <= 1);
  }
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

describe("agent-friendly 404s", () => {
  it("returns a recoverable Markdown 404 for GET and HEAD", async () => {
    const get = proxy(request("/missing-agent-path", "text/markdown"));
    assert.equal(get.status, 404);
    assert.equal(
      get.headers.get("content-type"),
      "text/markdown; charset=utf-8",
    );
    assert.equal(get.headers.get("vary"), VARY);

    const body = await get.text();
    assert.match(body, /^# Page introuvable$/m);
    for (const path of ["/sitemap.xml", "/llms.txt", "/support"]) {
      assert.ok(body.includes(`${SITE_URL}${path}`));
    }

    const head = proxy(request("/missing-agent-path", "text/markdown", "HEAD"));
    assert.equal(head.status, 404);
    assert.equal(
      head.headers.get("content-type"),
      "text/markdown; charset=utf-8",
    );
    assert.equal(head.headers.get("vary"), VARY);
    assert.equal(await head.text(), "");
  });

  it("rejects unavailable representations on missing routes", async () => {
    for (const accept of [
      "application/json",
      "text/html;q=0",
      "text/html;q=0, text/markdown;q=0",
    ]) {
      const response = proxy(request("/missing-unsupported-path", accept));
      assert.equal(response.status, 406, accept);
      assert.equal(response.headers.get("vary"), VARY);
      assert.equal(await response.text(), "");
    }
  });

  it("lets Next render the visual 404 and keeps every sitemap page valid", () => {
    const html = proxy(request("/missing-human-path", "text/html"));
    assert.equal(html.headers.get("x-middleware-next"), "1");
    assert.equal(html.headers.get("vary"), VARY);

    for (const { url } of sitemap()) {
      const response = proxy(
        request(new URL(url).pathname, "text/markdown, text/html;q=0.5"),
      );
      assert.notEqual(response.status, 404, url);
    }

    assert.match(notFoundSource, /robots: \{ index: false, follow: false \}/);
    assert.match(fr.notFound.text, /chemin demandé est inconnu/i);
    assert.doesNotMatch(fr.notFound.text, /déménag/i);
    for (const path of ["/sitemap.xml", "/llms.txt", "/support"]) {
      assert.ok(notFoundSource.includes(`href="${path}"`));
    }
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
    assert.doesNotMatch(nextConfigSource, /\bdistDir\s*:/);
    assert.match(deploymentIgnore, /^!landing\/public\/index\.md$/m);
    assert.equal(landingPackage.scripts.build, "next build --webpack");

    const patched = patchVaryHeaderSource(nextAppPageRuntime);
    assert.match(patched, /getVaryHeader\(e,t\).*?qm}, Accept`/);
    assert.equal(patchVaryHeaderSource(patched), patched);
    assert.throws(
      () => patchVaryHeaderSource("unexpected runtime"),
      /Vary patch target changed/,
    );
  });
});

describe("homepage raw HTML", () => {
  it("keeps useful content and an ordered heading outline without JavaScript", async () => {
    const markup = renderToStaticMarkup(await LandingPage());

    assert.ok(visibleText(markup).length > 500);
    assert.equal(markup.match(/<h1\b/g)?.length, 1);

    const levels = [...markup.matchAll(/<h([1-6])\b/g)].map((match) =>
      Number(match[1]),
    );
    assert.ok(levels.includes(2));
    for (let index = 1; index < levels.length; index += 1) {
      assert.ok(levels[index] - levels[index - 1] <= 1);
    }
  });
});

describe("trust anchors", () => {
  it("renders useful About and Privacy pages without JavaScript", async () => {
    const about = renderToStaticMarkup(await AboutPage());
    const privacy = renderToStaticMarkup(await PrivacyPage());

    assertTrustPage(about);
    assertTrustPage(privacy);
    assert.match(about, /https:\/\/github\.com\/neogenz\/pulpe/);
    assert.match(
      privacy,
      /https:\/\/app\.pulpe\.app\/legal\/confidentialite\?lang=fr/,
    );

    const claims = `${visibleText(about)} ${visibleText(privacy)}`;
    assert.doesNotMatch(claims, /(?:\+\d{7,}|rue |registre du commerce)/i);
  });

  it("publishes clean canonicals and sitemap entries", async () => {
    assert.equal((await aboutMetadata()).alternates?.canonical, ABOUT_ROUTE);
    assert.equal(
      (await privacyMetadata()).alternates?.canonical,
      PRIVACY_ROUTE,
    );

    const entries = sitemap();
    for (const route of [ABOUT_ROUTE, PRIVACY_ROUTE]) {
      const entry = entries.find(({ url }) => url === `${SITE_URL}${route}`);
      assert.ok(entry, `${route} is missing from the sitemap`);
      assert.equal(entry.alternates, undefined);
      assert.match(markdown, new RegExp(`https://pulpe\\.app${route}`));
      assert.match(llms, new RegExp(`https://pulpe\\.app${route}`));
    }
  });

  it("completes Organization without inventing an address or phone", () => {
    const graph = buildJsonLd("fr", "Description", ["Projection"])["@graph"];
    const organization = graph.find((node) => node["@type"] === "Organization");
    assert.ok(organization);
    assert.deepEqual(organization.contactPoint, {
      "@type": "ContactPoint",
      email: "maxime.desogus@gmail.com",
      contactType: "customer support",
      url: "https://pulpe.app/support",
      availableLanguage: ["fr", "en", "de", "it"],
    });
    assert.deepEqual(organization.address, {
      "@type": "PostalAddress",
      addressCountry: "CH",
    });
    assert.equal("telephone" in organization, false);
    assert.equal("streetAddress" in organization.address, false);
  });
});
