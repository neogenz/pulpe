import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it, mock } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SOCIAL_PREVIEW_ALT, SOCIAL_PREVIEW_IMAGE } from "../../lib/config";
import { GUIDES, guideMetadata, type Guide } from "./guides";

Object.assign(globalThis, { React });

// Under tsx, the default static next/image import yields the module object
// instead of the component (esbuild interop), breaking Header and Footer
// rendering. This mock replaces only that module; everything else renders.
const nextImageMock = {
  cache: false,
  exports: {
    default: (props: Record<string, unknown>) =>
      React.createElement("img", { src: props.src, alt: props.alt }),
  },
};
mock.module("next/image", nextImageMock);
const { ArticleLayout } = await import("./ArticleLayout");
const { default: BudgetSuisseGuidePage } =
  await import("../../app/conseils-budget/comment-faire-son-budget-en-suisse/page");
const { metadata: guidesIndexMetadata } =
  await import("../../app/conseils-budget/page");

const sources = {
  articleLayout: readFileSync(
    new URL("./ArticleLayout.tsx", import.meta.url),
    "utf8",
  ),
  config: readFileSync(new URL("../../lib/config.ts", import.meta.url), "utf8"),
  globals: readFileSync(
    new URL("../../app/globals.css", import.meta.url),
    "utf8",
  ),
  guides: readFileSync(new URL("./guides.ts", import.meta.url), "utf8"),
  layout: readFileSync(
    new URL("../../app/layout.tsx", import.meta.url),
    "utf8",
  ),
  supportGuide: readFileSync(
    new URL("../../app/support/modeles-et-budgets/page.tsx", import.meta.url),
    "utf8",
  ),
};

const guide: Guide = {
  slug: "guide-de-test",
  title: "Titre du guide de test",
  description: "Description du guide de test.",
  publishedAt: "2026-08-01",
  updatedAt: "2026-08-13",
  readingMinutes: 6,
};

const faq = [
  { question: "Première question ?", answer: "Première réponse courte." },
  { question: "Deuxième question ?", answer: "Deuxième réponse courte." },
];

function extractJsonLd(markup: string) {
  const scripts = [
    ...markup.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    ),
  ];
  assert.equal(
    scripts.length,
    1,
    "ArticleLayout must emit exactly one JSON-LD script",
  );
  return JSON.parse(scripts[0][1]) as {
    "@graph": Record<string, unknown>[];
  };
}

describe("guide article layout contract", () => {
  const html = renderToStaticMarkup(
    <ArticleLayout guide={guide} faq={faq}>
      <p>Corps du guide, présent dans le HTML serveur.</p>
    </ArticleLayout>,
  );

  it("renders exactly one h1 and the server-side content", () => {
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1);
    assert.ok(html.includes("Corps du guide, présent dans le HTML serveur."));
    assert.ok(html.includes('class="guide-prose'));
  });

  it("renders one single primary CTA inside the article", () => {
    const article = html.match(/<article[\s\S]*<\/article>/)?.[0];
    assert.ok(article, "the layout must wrap content in an <article>");
    assert.equal(article.match(/data-cta-name=/g)?.length, 1);
  });

  it("emits a valid Article schema fed by the registry entry", () => {
    const graph = extractJsonLd(html)["@graph"];
    const article = graph.find((node) => node["@type"] === "Article");
    assert.ok(article, "Article node is missing from the JSON-LD graph");
    assert.equal(article.headline, guide.title);
    assert.equal(article.description, guide.description);
    assert.equal(article.datePublished, guide.publishedAt);
    assert.equal(article.dateModified, guide.updatedAt);
    assert.deepEqual(article.publisher, {
      "@type": "Organization",
      "@id": "https://pulpe.app/#org",
      name: "Pulpe",
    });
    assert.equal(
      article.url,
      `https://pulpe.app/conseils-budget/${guide.slug}`,
    );
  });

  it("keeps route-specific social metadata tied to the shared preview", () => {
    const indexOpenGraph = guidesIndexMetadata.openGraph as {
      title?: unknown;
      description?: unknown;
      url?: unknown;
      images?: { url?: unknown; alt?: unknown }[];
    };
    const indexTwitter = guidesIndexMetadata.twitter as {
      title?: unknown;
      description?: unknown;
      images?: { url?: unknown; alt?: unknown }[];
    };

    assert.equal(indexOpenGraph.title, "Conseils budget | Pulpe");
    assert.equal(indexOpenGraph.description, guidesIndexMetadata.description);
    assert.equal(indexOpenGraph.url, "/conseils-budget");
    assert.equal(indexTwitter.title, indexOpenGraph.title);
    assert.equal(indexTwitter.description, indexOpenGraph.description);
    for (const social of [indexOpenGraph, indexTwitter]) {
      assert.equal(social.images?.[0]?.url, SOCIAL_PREVIEW_IMAGE);
      assert.equal(social.images?.[0]?.alt, SOCIAL_PREVIEW_ALT);
    }

    const articleOpenGraph = guideMetadata(guide).openGraph as {
      publishedTime?: unknown;
      modifiedTime?: unknown;
    };
    assert.equal(articleOpenGraph.publishedTime, guide.publishedAt);
    assert.equal(articleOpenGraph.modifiedTime, guide.updatedAt);
  });

  it("centralizes social data and keeps Organization claims accurate", () => {
    const allSocialSources = Object.values(sources).join("\n");
    assert.equal(
      allSocialSources.match(/pulpe-social-preview\.png\?v=2/g)?.length,
      1,
    );
    assert.match(
      sources.config,
      /export const SOCIAL_PREVIEW_IMAGE = "\/pulpe-social-preview\.png\?v=2";/,
    );
    assert.doesNotMatch(sources.layout, /\bsameAs\s*:/);
  });

  it("keeps article links interactive and the Pulpe pull quote semantic", () => {
    const interactionStyles = sources.globals.match(
      /\.guide-prose a:hover,\s*\.guide-prose a:focus-visible\s*\{[^}]*\}/,
    );
    assert.ok(interactionStyles, "article link interaction styles are missing");
    assert.match(interactionStyles[0], /text-decoration-thickness:/);
    assert.doesNotMatch(interactionStyles[0], /color:/);
    assert.doesNotMatch(sources.articleLayout, /hover:text-primary-hover/);
    assert.match(sources.articleLayout, /hover:underline/);
    const pageHtml = renderToStaticMarkup(<BudgetSuisseGuidePage />);
    const article = pageHtml.match(/<article[\s\S]*<\/article>/)?.[0];
    assert.ok(article, "the page must render an <article>");
    assert.doesNotMatch(article, /<blockquote[\s>]/);
    assert.match(article, /class="guide-pull-quote"/);
  });

  it("keeps the FAQPage schema identical to the visible FAQ", () => {
    const graph = extractJsonLd(html)["@graph"];
    const faqPage = graph.find((node) => node["@type"] === "FAQPage") as
      | { mainEntity: { name: string; acceptedAnswer: { text: string } }[] }
      | undefined;
    assert.ok(faqPage, "FAQPage node is missing from the JSON-LD graph");
    assert.deepEqual(
      faqPage.mainEntity.map((entry) => ({
        question: entry.name,
        answer: entry.acceptedAnswer.text,
      })),
      faq,
    );
    // The ld+json script already contains the copy. Exclude it to prove the FAQ
    // is visible rather than only present in the schema.
    const visibleHtml = html.replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/g,
      "",
    );
    for (const entry of faq) {
      assert.ok(visibleHtml.includes(entry.question), entry.question);
      assert.ok(visibleHtml.includes(entry.answer), entry.answer);
    }
  });

  it("omits the FAQ section and FAQPage schema when no faq is provided", () => {
    const bare = renderToStaticMarkup(
      <ArticleLayout guide={guide}>
        <p>Corps du guide.</p>
      </ArticleLayout>,
    );
    assert.ok(!bare.includes("Questions fréquentes"));
    const graph = extractJsonLd(bare)["@graph"];
    assert.equal(
      graph.find((node) => node["@type"] === "FAQPage"),
      undefined,
    );
  });

  it("dates the article with machine-readable time elements", () => {
    assert.ok(html.includes(`<time dateTime="${guide.publishedAt}"`));
    assert.ok(html.includes(`<time dateTime="${guide.updatedAt}"`));
    const samePublishedAndUpdated = renderToStaticMarkup(
      <ArticleLayout guide={{ ...guide, updatedAt: guide.publishedAt }}>
        <p>Corps.</p>
      </ArticleLayout>,
    );
    assert.ok(!samePublishedAndUpdated.includes("Mis à jour le"));
  });

  it("keeps the seed article itself to one h1 and one CTA", () => {
    const pageHtml = renderToStaticMarkup(<BudgetSuisseGuidePage />);
    assert.equal(pageHtml.match(/<h1[\s>]/g)?.length, 1);
    const article = pageHtml.match(/<article[\s\S]*<\/article>/)?.[0];
    assert.ok(article, "the page must render an <article>");
    assert.equal(article.match(/data-cta-name=/g)?.length, 1);
  });

  it("labels the budget table and keeps its borders on legacy Safari", () => {
    const pageHtml = renderToStaticMarkup(<BudgetSuisseGuidePage />);
    assert.match(
      pageHtml,
      /<caption class="sr-only">Exemple de budget pour un revenu net de 5’000[^<]+CHF par mois<\/caption>/,
    );
    const tableCellStyles = sources.globals.match(
      /\.guide-prose th,\s*\.guide-prose td\s*\{[^}]*\}/,
    );
    assert.ok(tableCellStyles, "guide table cell styles are missing");
    assert.match(tableCellStyles[0], /rgba\(26, 28, 25, 0\.1\)/);
    assert.match(tableCellStyles[0], /color-mix\(/);
  });

  it("has a page for every registry entry", () => {
    for (const entry of GUIDES) {
      assert.ok(
        existsSync(
          new URL(
            `../../app/conseils-budget/${entry.slug}/page.tsx`,
            import.meta.url,
          ),
        ),
        `app/conseils-budget/${entry.slug}/page.tsx is missing: the index card and sitemap would point to a 404`,
      );
    }
  });
});
