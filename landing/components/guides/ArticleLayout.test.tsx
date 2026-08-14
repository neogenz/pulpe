import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it, mock } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GUIDES, type Guide } from "./guides";

Object.assign(globalThis, { React });

// Sous tsx, l'import statique par défaut de next/image livre l'objet module au
// lieu du composant (interop esbuild) et fait échouer le rendu du Header et du
// Footer. Le mock ne remplace que ce module ; tout le reste rend en vrai.
mock.module("next/image", {
  defaultExport: (props: Record<string, unknown>) =>
    React.createElement("img", { src: props.src, alt: props.alt }),
});
const { ArticleLayout } = await import("./ArticleLayout");
const { default: BudgetSuisseGuidePage } =
  await import("../../app/conseils-budget/comment-faire-son-budget-en-suisse/page");

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
  assert.equal(scripts.length, 1, "exactly one JSON-LD script per article");
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
    // Le script ld+json contient déjà les textes : on l'exclut du markup pour
    // prouver que la FAQ est rendue visible, pas seulement présente au schema.
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

  it("has a page for every registry entry", () => {
    for (const entry of GUIDES) {
      assert.ok(
        existsSync(
          new URL(
            `../../app/conseils-budget/${entry.slug}/page.tsx`,
            import.meta.url,
          ),
        ),
        `app/conseils-budget/${entry.slug}/page.tsx est absent : la carte de l'index et le sitemap pointeraient sur un 404`,
      );
    }
  });
});
