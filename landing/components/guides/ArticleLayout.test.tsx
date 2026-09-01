import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it, mock } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getDictionary } from "../../content/dictionary";
import { DEFAULT_LOCALE } from "../../lib/i18n";
import { socialPreviewImage } from "../../lib/metadata";
import { DE_GUIDE_CHROME } from "./chrome";
import {
  DE_COMPARISON_SLUG,
  DE_GUIDES,
  DE_PREMIUMS_SLUG,
  getDeGuide,
} from "./guides.de";
import { GUIDES, guideMetadata, type Guide } from "./guides";
import sitemap from "../../app/sitemap";

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
  await import("../../app/(fr)/conseils-budget/comment-faire-son-budget-en-suisse/page");
const { default: PrimesMaladieGuidePage } =
  await import("../../app/(fr)/conseils-budget/budgeter-primes-maladie/page");
const { generateMetadata: guidesIndexMetadata } =
  await import("../../app/(fr)/conseils-budget/page");
const {
  default: DeComparisonPage,
  generateStaticParams: generateDeGuideStaticParams,
  generateMetadata: generateDeGuideMetadata,
} = await import("../../app/[lang]/budget-ratgeber/[slug]/page");

const sources = {
  articleLayout: readFileSync(
    new URL("./ArticleLayout.tsx", import.meta.url),
    "utf8",
  ),
  globals: readFileSync(
    new URL("../../app/globals.css", import.meta.url),
    "utf8",
  ),
  guides: readFileSync(new URL("./guides.ts", import.meta.url), "utf8"),
  rootDocument: readFileSync(
    new URL("../../components/RootDocument.tsx", import.meta.url),
    "utf8",
  ),
  supportGuide: readFileSync(
    new URL(
      "../../app/(fr)/support/modeles-et-budgets/page.tsx",
      import.meta.url,
    ),
    "utf8",
  ),
};

const dict = await getDictionary(DEFAULT_LOCALE);

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

describe("guide article layout contract", async () => {
  const html = renderToStaticMarkup(
    <ArticleLayout guide={guide} faq={faq} dict={dict}>
      <p>Corps du guide, présent dans le HTML serveur.</p>
    </ArticleLayout>,
  );
  // La page est un composant serveur asynchrone : elle s'appelle, elle ne se
  // rend pas comme un élément.
  const pageHtml = renderToStaticMarkup(await BudgetSuisseGuidePage());

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
    assert.deepEqual(article.author, {
      "@type": "Person",
      name: "Maxime De Sogus",
      url: "https://pulpe.app/about",
    });
    assert.deepEqual(article.publisher, {
      "@type": "Organization",
      "@id": "https://pulpe.app/#org",
      name: "Pulpe",
    });
    assert.equal(
      article.url,
      `https://pulpe.app/conseils-budget/${guide.slug}`,
    );
    assert.equal(article.inLanguage, "fr-CH");
  });

  it("keeps route-specific social metadata tied to the shared preview", async () => {
    const indexMetadata = await guidesIndexMetadata();
    const indexOpenGraph = indexMetadata.openGraph as {
      title?: unknown;
      description?: unknown;
      url?: unknown;
      images?: { url?: unknown; alt?: unknown }[];
    };
    const indexTwitter = indexMetadata.twitter as {
      title?: unknown;
      description?: unknown;
      images?: { url?: unknown; alt?: unknown }[];
    };

    assert.equal(indexOpenGraph.title, "Conseils budget | Pulpe");
    assert.equal(indexOpenGraph.description, indexMetadata.description);
    assert.equal(indexOpenGraph.url, "/conseils-budget");
    assert.equal(indexTwitter.title, indexOpenGraph.title);
    assert.equal(indexTwitter.description, indexOpenGraph.description);
    for (const social of [indexOpenGraph, indexTwitter]) {
      // Ces pages n'existent qu'en français : elles portent la vignette
      // française, pas celle de la langue du visiteur.
      assert.equal(social.images?.[0]?.url, socialPreviewImage(DEFAULT_LOCALE));
      assert.equal(social.images?.[0]?.alt, dict.site.socialImageAlt);
    }

    const articleMetadata = await guideMetadata(guide);
    const articleOpenGraph = articleMetadata.openGraph as {
      publishedTime?: unknown;
      modifiedTime?: unknown;
      locale?: unknown;
    };
    assert.equal(articleOpenGraph.publishedTime, guide.publishedAt);
    assert.equal(articleOpenGraph.modifiedTime, guide.updatedAt);
    assert.equal(articleOpenGraph.locale, "fr_CH");
    assert.equal(
      articleMetadata.alternates?.canonical,
      `/conseils-budget/${guide.slug}`,
    );
  });

  it("centralizes social data and keeps Organization claims accurate", () => {
    // Le nom du fichier et sa version vivent dans `lib/metadata.ts` seul : un
    // guide qui le réécrirait à la main figerait une vignette périmée.
    for (const source of Object.values(sources)) {
      assert.doesNotMatch(source, /pulpe-social-preview/);
    }
    assert.match(sources.articleLayout, /socialPreviewImage\(/);
    assert.match(sources.rootDocument, /sameAs: \[GITHUB_URL, IOS_APP_URL\]/);
    assert.match(sources.rootDocument, /countriesSupported: \["FR", "CH"\]/);
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
      <ArticleLayout guide={guide} dict={dict}>
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
      <ArticleLayout
        guide={{ ...guide, updatedAt: guide.publishedAt }}
        dict={dict}
      >
        <p>Corps.</p>
      </ArticleLayout>,
    );
    assert.ok(!samePublishedAndUpdated.includes("Mis à jour le"));
  });

  it("keeps the seed article itself to one h1 and one CTA", () => {
    assert.equal(pageHtml.match(/<h1[\s>]/g)?.length, 1);
    const article = pageHtml.match(/<article[\s\S]*<\/article>/)?.[0];
    assert.ok(article, "the page must render an <article>");
    assert.equal(article.match(/data-cta-name=/g)?.length, 1);
  });

  it("labels the budget table and keeps its borders on legacy Safari", () => {
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
            `../../app/(fr)/conseils-budget/${entry.slug}/page.tsx`,
            import.meta.url,
          ),
        ),
        `app/(fr)/conseils-budget/${entry.slug}/page.tsx is missing: the index card and sitemap would point to a 404`,
      );
    }
  });

  it("keeps the German registry out of GUIDES and fails on unknown slugs", () => {
    assert.equal(DE_GUIDES.length, 2);
    const frenchSlugs = new Set(GUIDES.map((entry) => entry.slug));
    const germanSlugs = new Set<string>();
    for (const entry of DE_GUIDES) {
      assert.ok(!frenchSlugs.has(entry.slug), entry.slug);
      assert.ok(!germanSlugs.has(entry.slug), entry.slug);
      germanSlugs.add(entry.slug);
    }
    assert.throws(() => getDeGuide("slug-inconnu"));
  });

  it("renders German chrome without French chrome copy", async () => {
    const deDict = await getDictionary("de");
    const html = renderToStaticMarkup(
      <ArticleLayout
        guide={guide}
        faq={faq}
        dict={deDict}
        chrome={DE_GUIDE_CHROME}
      >
        <p>Deutscher Artikelkörper.</p>
      </ArticleLayout>,
    );
    const graph = extractJsonLd(html)["@graph"];
    const article = graph.find((node) => node["@type"] === "Article");
    assert.ok(article, "Article node is missing from the JSON-LD graph");
    assert.equal(article.inLanguage, "de-CH");
    assert.equal(typeof article.url, "string");
    assert.ok(
      String(article.url).includes("/de/budget-ratgeber/"),
      String(article.url),
    );
    assert.ok(!html.includes("Publié le"));
    assert.ok(!html.includes("Conseils budget"));
    assert.ok(!html.includes("Questions fréquentes"));
    assert.ok(html.includes("Startseite"));
    assert.ok(html.includes("Veröffentlicht am"));
    assert.ok(html.includes("Häufige Fragen"));
    assert.ok(html.includes("Budget kostenlos erstellen"));
    assert.ok(html.includes("Budget erstellen"));
    assert.doesNotMatch(html, /Transaktion/);
    const chromeCopy = [
      DE_GUIDE_CHROME.backLabel,
      DE_GUIDE_CHROME.publishedPrefix,
      DE_GUIDE_CHROME.updatedPrefix,
      DE_GUIDE_CHROME.faqHeading,
      DE_GUIDE_CHROME.relatedHeading,
      DE_GUIDE_CHROME.ctaLead,
      DE_GUIDE_CHROME.ctaButton,
      DE_GUIDE_CHROME.readingTime(6),
    ].join(" ");
    assert.doesNotMatch(chromeCopy, /\bSie\b/);
    assert.doesNotMatch(chromeCopy, /Transaktion/);
  });
});

describe("German budget comparison page", async () => {
  const pageHtml = renderToStaticMarkup(
    await DeComparisonPage({
      params: Promise.resolve({
        lang: "de",
        slug: "beste-budget-app-schweiz",
      }),
    }),
  );
  const articleHtml = pageHtml.match(/<article[\s\S]*<\/article>/)?.[0];
  const graph = extractJsonLd(pageHtml)["@graph"];
  const articleLd = graph.find((node) => node["@type"] === "Article");

  it("emits de + slug for every German registry entry", () => {
    const deParams = generateDeGuideStaticParams();
    assert.deepEqual(
      deParams,
      DE_GUIDES.map((entry) => ({ lang: "de", slug: entry.slug })),
    );
    assert.ok(deParams.length > 0);
    assert.equal(
      deParams.every((entry) => entry.lang === "de"),
      true,
    );
  });

  it("keeps a de-CH canonical without four-language alternates", async () => {
    const metadata = await generateDeGuideMetadata({
      params: Promise.resolve({
        lang: "de",
        slug: "beste-budget-app-schweiz",
      }),
    });
    assert.equal(
      metadata.alternates?.canonical,
      "/de/budget-ratgeber/beste-budget-app-schweiz",
    );
    assert.equal(metadata.alternates?.languages, undefined);
  });

  it("answers with Budget-App Schweiz, a Deutsch column, and a Pulpe limit", () => {
    assert.equal(pageHtml.match(/<h1[\s>]/g)?.length, 1);
    assert.match(
      pageHtml,
      /<h1[^>]*>[\s\S]*Budget-App[\s\S]*Schweiz[\s\S]*<\/h1>/,
    );
    assert.ok(articleHtml, "the page must render an <article>");
    assert.match(articleHtml, /<th[^>]*>Deutsch<\/th>/);
    assert.doesNotMatch(articleHtml, /Français/);
    assert.ok(articleHtml.includes("Pulpe"));
    assert.ok(articleHtml.includes("BudgetCH") || articleHtml.includes("YNAB"));
    assert.match(
      articleHtml,
      /Bankensynchronisation|Haushaltsbudget|junges Produkt/,
    );
    assert.doesNotMatch(pageHtml, /Transaktion/);
    assert.ok(!pageHtml.includes("Publié le"));
    assert.match(pageHtml, /krankenkassenpraemien-budgetieren/);
  });

  it("emits Article JSON-LD in de-CH", () => {
    assert.ok(articleLd, "Article node is missing from the JSON-LD graph");
    assert.equal(articleLd.inLanguage, "de-CH");
    assert.equal(
      articleLd.url,
      "https://pulpe.app/de/budget-ratgeber/beste-budget-app-schweiz",
    );
  });
});

describe("German health-premiums guide", async () => {
  const pageHtml = renderToStaticMarkup(
    await DeComparisonPage({
      params: Promise.resolve({
        lang: "de",
        slug: "krankenkassenpraemien-budgetieren",
      }),
    }),
  );
  const articleHtml = pageHtml.match(/<article[\s\S]*<\/article>/)?.[0];
  const graph = extractJsonLd(pageHtml)["@graph"];
  const articleLd = graph.find((node) => node["@type"] === "Article");

  it("cites BAG 2026 figures next to a bag.admin.ch source", () => {
    assert.ok(articleHtml, "the page must render an <article>");
    assert.ok(articleHtml.includes("393.30"));
    assert.ok(articleHtml.includes("326.30"));
    assert.ok(articleHtml.includes("4,4"));
    assert.ok(articleHtml.includes("4,2"));
    assert.match(articleHtml, /bag\.admin\.ch/);
    assert.match(articleHtml, /Rückstellung/);
    assert.ok(articleHtml.includes("380"));
    assert.ok(articleHtml.includes("397"));
    assert.ok(articleHtml.includes("17"));
    assert.match(articleHtml, /vier Monate|17 × 4/);
    assert.doesNotMatch(pageHtml, /teile die Differenz durch die Monate/);
    assert.match(pageHtml, /multiplizierst/);
    assert.doesNotMatch(pageHtml, /Transaktion/);
    assert.doesNotMatch(articleHtml, /\bSie\b/);
    assert.match(articleHtml, /\b[Dd]u\b|\bdein/);
  });

  it("keeps de-CH chrome, links the comparison, and omits French hreflang", async () => {
    assert.equal(pageHtml.match(/<h1[\s>]/g)?.length, 1);
    assert.ok(articleLd, "Article node is missing from the JSON-LD graph");
    assert.equal(articleLd.inLanguage, "de-CH");
    assert.ok(!pageHtml.includes("Publié le"));
    assert.ok(!pageHtml.includes("Conseils budget"));
    assert.match(pageHtml, /\/de\/budget-ratgeber\/beste-budget-app-schweiz/);
    const metadata = await generateDeGuideMetadata({
      params: Promise.resolve({
        lang: "de",
        slug: "krankenkassenpraemien-budgetieren",
      }),
    });
    assert.equal(
      metadata.alternates?.canonical,
      "/de/budget-ratgeber/krankenkassenpraemien-budgetieren",
    );
    assert.equal(metadata.alternates?.languages, undefined);
  });
});

describe("French health-premiums guide", async () => {
  const pageHtml = renderToStaticMarkup(await PrimesMaladieGuidePage());
  const articleHtml = pageHtml.match(/<article[\s\S]*<\/article>/)?.[0];

  it("aligns the provision formula with the worked example", () => {
    assert.ok(articleHtml, "the page must render an <article>");
    assert.doesNotMatch(pageHtml, /divise la différence par le nombre de mois/);
    assert.match(pageHtml, /multiplies par les mois/);
    assert.match(articleHtml, /17 × 4/);
  });

  it("uses the product label instead of English available", () => {
    assert.doesNotMatch(pageHtml, /\bavailable\b/i);
    assert.match(pageHtml, /disponible à dépenser/);
  });

  it("sources the young-adult 4,2 % on the OFSP communiqué", () => {
    assert.match(articleHtml ?? "", /4,2/);
    assert.match(
      articleHtml ?? "",
      /bag\.admin\.ch\/fr\/newnsb\/d2okh_kUK_OFhmMDfpyiy/,
    );
  });
});

describe("German advice discovery", () => {
  it("lists both German URLs in the sitemap without alternates", () => {
    const entries = sitemap();
    for (const slug of [DE_COMPARISON_SLUG, DE_PREMIUMS_SLUG]) {
      const entry = entries.find(
        (candidate) =>
          candidate.url === `https://pulpe.app/de/budget-ratgeber/${slug}`,
      );
      assert.ok(entry, slug);
      assert.equal(entry.alternates, undefined);
    }
  });
});
