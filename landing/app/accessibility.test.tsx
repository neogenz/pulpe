import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it, mock } from "node:test";
import { LOCALES } from "../lib/i18n";
import { angularUrl } from "../lib/config";
import { socialPreviewFile, socialPreviewImage } from "../lib/metadata";
import { OPEN_GRAPH_LOCALE, openGraphAlternates } from "../lib/routes";
import {
  changelogMetadata,
  supportMetadata,
} from "../components/pages/metadata";
import type { PostHog } from "posthog-js/dist/module.slim";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Testimonials } from "../components/sections/Testimonials";
import { AccordionItem } from "../components/ui/AccordionItem";
// Nommés `…Dict` : `it` importé nu masquerait le `it` de `node:test`, et la
// suite entière se charge alors sans exécuter un seul bloc.
import frDict from "../content/dictionaries/fr";
import enDict from "../content/dictionaries/en";
import deDict from "../content/dictionaries/de";
import itDict from "../content/dictionaries/it";

const CATALOGS = {
  fr: frDict,
  en: enDict,
  de: deDict,
  it: itDict,
} as const;

/**
 * Toutes les chaînes d'une tranche de catalogue, à plat. Les assertions de
 * copie portent désormais sur le catalogue et non sur le texte source des
 * composants : le balisage ne contient plus un mot de français.
 */
function allStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(allStrings);
  }
  return [];
}

function joined(value: unknown): string {
  return allStrings(value).join("\n");
}

type SupportFaq = (typeof frDict)["support"]["faq"];
type SupportFaqEntry = SupportFaq[keyof SupportFaq];

/**
 * La réponse telle que la page la recolle pour le JSON-LD. Une entrée qui porte
 * un lien en ligne est écrite en trois morceaux ; le texte nu est leur somme,
 * jamais une seconde rédaction.
 */
function answerText(entry: SupportFaqEntry): string {
  return "answer" in entry
    ? entry.answer
    : `${entry.answerBefore}${entry.answerLink}${entry.answerAfter}`;
}

function supportFaq(catalog: (typeof CATALOGS)[keyof typeof CATALOGS]) {
  return Object.values(catalog.support.faq) as SupportFaqEntry[];
}

Object.assign(globalThis, { React });

const nextImageMock = {
  cache: false,
  exports: {
    default: (props: Record<string, unknown>) =>
      React.createElement("img", { src: props.src, alt: props.alt }),
  },
};
mock.module("next/image", nextImageMock);
const { Footer } = await import("../components/sections/Footer");

const globalsCss = readFileSync(
  new URL("./globals.css", import.meta.url),
  "utf8",
);

const componentSources = {
  button: readFileSync(
    new URL("../components/ui/Button.tsx", import.meta.url),
    "utf8",
  ),
  header: readFileSync(
    new URL("../components/sections/Header.tsx", import.meta.url),
    "utf8",
  ),
  hero: readFileSync(
    new URL("../components/sections/Hero.tsx", import.meta.url),
    "utf8",
  ),
  page: readFileSync(
    new URL("../components/pages/Home.tsx", import.meta.url),
    "utf8",
  ),
  support: readFileSync(
    new URL("../components/pages/Support.tsx", import.meta.url),
    "utf8",
  ),
  supportGuide: readFileSync(
    new URL("../components/pages/SupportGuide.tsx", import.meta.url),
    "utf8",
  ),
  guidesIndex: readFileSync(
    new URL("./(fr)/conseils-budget/page.tsx", import.meta.url),
    "utf8",
  ),
  guideArticle: readFileSync(
    new URL(
      "./(fr)/conseils-budget/comment-faire-son-budget-en-suisse/page.tsx",
      import.meta.url,
    ),
    "utf8",
  ),
  articleLayout: readFileSync(
    new URL("../components/guides/ArticleLayout.tsx", import.meta.url),
    "utf8",
  ),
  painPoints: readFileSync(
    new URL("../components/sections/PainPoints.tsx", import.meta.url),
    "utf8",
  ),
  solution: readFileSync(
    new URL("../components/sections/Solution.tsx", import.meta.url),
    "utf8",
  ),
  features: readFileSync(
    new URL("../components/sections/Features.tsx", import.meta.url),
    "utf8",
  ),
  section: readFileSync(
    new URL("../components/ui/Section.tsx", import.meta.url),
    "utf8",
  ),
  howItWorks: readFileSync(
    new URL("../components/sections/HowItWorks.tsx", import.meta.url),
    "utf8",
  ),
  howItWorksVisuals: readFileSync(
    new URL("../components/sections/HowItWorksVisuals.tsx", import.meta.url),
    "utf8",
  ),
  accordionItem: readFileSync(
    new URL("../components/ui/AccordionItem.tsx", import.meta.url),
    "utf8",
  ),
  fadeIn: readFileSync(
    new URL("../components/ui/FadeIn.tsx", import.meta.url),
    "utf8",
  ),
  heroDashboard: readFileSync(
    new URL("../components/ui/HeroDashboard.tsx", import.meta.url),
    "utf8",
  ),
  money: readFileSync(
    new URL("../components/ui/Money.tsx", import.meta.url),
    "utf8",
  ),
  whyFree: readFileSync(
    new URL("../components/sections/WhyFree.tsx", import.meta.url),
    "utf8",
  ),
  testimonials: readFileSync(
    new URL("../components/sections/Testimonials.tsx", import.meta.url),
    "utf8",
  ),
  finalCta: readFileSync(
    new URL("../components/sections/FinalCTA.tsx", import.meta.url),
    "utf8",
  ),
  platforms: readFileSync(
    new URL("../components/sections/Platforms.tsx", import.meta.url),
    "utf8",
  ),
  stickyCta: readFileSync(
    new URL("../components/ui/StickyCTA.tsx", import.meta.url),
    "utf8",
  ),
  arrowNote: readFileSync(
    new URL("../components/ui/ArrowNote.tsx", import.meta.url),
    "utf8",
  ),
  faq: readFileSync(
    new URL("../components/sections/FAQ.tsx", import.meta.url),
    "utf8",
  ),
  footer: readFileSync(
    new URL("../components/sections/Footer.tsx", import.meta.url),
    "utf8",
  ),
  // Le document racine partagé par les deux layouts, français et préfixé.
  layout: readFileSync(
    new URL("../components/RootDocument.tsx", import.meta.url),
    "utf8",
  ),
  metadata: readFileSync(
    new URL("../lib/metadata.ts", import.meta.url),
    "utf8",
  ),
  pageMetadata: readFileSync(
    new URL("../components/pages/metadata.ts", import.meta.url),
    "utf8",
  ),
  ogGenerator: readFileSync(
    new URL("../scripts/generate-og-image.ts", import.meta.url),
    "utf8",
  ),
  posthog: readFileSync(new URL("../lib/posthog.ts", import.meta.url), "utf8"),
  posthogProvider: readFileSync(
    new URL("../components/PostHogProvider.tsx", import.meta.url),
    "utf8",
  ),
};

// Les trois documents qui portent leur propre `<html>` : la racine française,
// la racine préfixée et le 404 global.
const rootDocuments = {
  french: readFileSync(new URL("./(fr)/layout.tsx", import.meta.url), "utf8"),
  prefixed: readFileSync(
    new URL("./[lang]/layout.tsx", import.meta.url),
    "utf8",
  ),
  notFound: readFileSync(
    new URL("./global-not-found.tsx", import.meta.url),
    "utf8",
  ),
};

// La source des trois visuels de planification, son `FULL_MONTH` résolu. Deux
// tests ont besoin de cette valeur pour additionner ; ils la lisent de la
// source plutôt que d'en garder une copie, qui ne suivrait pas la constante.
const fullMonthDeclaration = componentSources.howItWorksVisuals.match(
  /const FULL_MONTH = (\d+)/,
);
assert.ok(fullMonthDeclaration, "HowItWorksVisuals ne déclare plus FULL_MONTH");
const fullMonth = fullMonthDeclaration[1];
const planningVisuals = componentSources.howItWorksVisuals.replace(
  /FULL_MONTH/g,
  fullMonth,
);

// Les douze disponibles du graphe annuel, `FULL_MONTH` déjà résolu. Les mois
// eux-mêmes n'ont plus d'initiale ici : elle vient du catalogue, parce que
// l'année italienne commence par `G`.
function monthAvailable(): number[] {
  const block = planningVisuals.match(
    /const MONTH_AVAILABLE = \[([\s\S]*?)\];/,
  );
  assert.ok(block, "HowItWorksVisuals ne déclare plus MONTH_AVAILABLE");
  return [...block[1].matchAll(/\d+/g)].map(([amount]) => Number(amount));
}

function getDeclarations(selector: string): string {
  const ruleStart = globalsCss.indexOf(`${selector} {`);
  assert.notEqual(ruleStart, -1, `Missing CSS rule: ${selector}`);

  const declarationsStart = globalsCss.indexOf("{", ruleStart) + 1;
  const declarationsEnd = globalsCss.indexOf("}", declarationsStart);
  return globalsCss.slice(declarationsStart, declarationsEnd);
}

describe("landing accessibility contracts", () => {
  it("keeps component geometry unchanged while focused", () => {
    for (const selector of [":focus-visible", ".focus-on-dark:focus-visible"]) {
      assert.doesNotMatch(
        getDeclarations(selector),
        /\bborder-radius\s*:/,
        `${selector} must not override the component border radius`,
      );
    }
  });

  it("keeps ambient gradients valid when oklab interpolation is supported", () => {
    assert.match(globalsCss, /--gradient-interpolation:\s*in oklab;/);
    assert.doesNotMatch(globalsCss, /--gradient-interpolation:\s*in oklab,;/);
    assert.match(
      globalsCss,
      /radial-gradient\(\s*var\(--gradient-interpolation\)\s*62% 11% at -5% 8%,/,
    );
    assert.doesNotMatch(
      globalsCss,
      /at\s+[-\d.%]+\s+[-\d.%]+\s+var\(--gradient-interpolation\)/,
    );
  });

  it("keeps secondary copy readable across the ambient gradient", () => {
    assert.match(globalsCss, /--color-text-secondary:\s*#454744;/);
  });

  it("uses Borumi-style section fields instead of the page gradient on mobile", () => {
    const sectionFields = globalsCss.match(
      /\.hero-mesh::before,[\s\S]*?\.pain-points-mesh::after\s*\{([\s\S]*?)\}/,
    )?.[1];

    assert.match(
      globalsCss,
      /@media \(max-width: 767px\)[\s\S]*body\s*\{[\s\S]*background-image:\s*none;/,
    );
    assert.match(
      globalsCss,
      /\.hero-mesh,\s*\.pain-points-mesh\s*\{[\s\S]*isolation:\s*isolate;/,
    );
    assert.match(
      globalsCss,
      /@media \(max-width: 767px\)[\s\S]*#main-content\s*\{[\s\S]*overflow:\s*clip;/,
    );
    assert.match(
      globalsCss,
      /@media \(max-width: 767px\)[\s\S]*\.hero-mesh,\s*\.pain-points-mesh\s*\{[\s\S]*overflow:\s*visible;/,
    );
    assert.ok(sectionFields, "The shared mobile section field is missing");
    // Le fondu Borumi est conservé, mais dessiné en dégradé : un `blur(150px)`
    // sur une boîte plus étroite que son rayon forçait une couche hors écran
    // d'environ 52 Mo par halo, quatre fois par page.
    assert.match(sectionFields, /width:\s*calc\(40vw \+ 600px\);/);
    assert.match(sectionFields, /height:\s*calc\(60vh \+ 600px\);/);
    assert.match(
      sectionFields,
      /transform:\s*translateY\(-50%\) rotate\(-30deg\);/,
    );
    assert.doesNotMatch(sectionFields, /filter:\s*blur/);
    assert.match(sectionFields, /radial-gradient\([\s\S]*var\(--halo\)/);
    assert.match(sectionFields, /opacity:\s*0\.07;/);
    assert.match(globalsCss, /--ambient-mobile-leaf:\s*oklch\(70% 0\.2 145\);/);
    assert.match(
      globalsCss,
      /--ambient-mobile-mint:\s*oklch\(75% 0\.18 164\);/,
    );
    assert.match(
      globalsCss,
      /--ambient-mobile-lime:\s*oklch\(82% 0\.19 121\);/,
    );
    // Les ancrages compensent l'agrandissement de la boîte pour que le centre
    // de chaque halo reste là où le flou le plaçait.
    assert.match(
      globalsCss,
      /\.hero-mesh::before,[\s\S]*?\.pain-points-mesh::before\s*\{(?=[\s\S]*?left:\s*calc\(-10% - 300px\);)(?=[\s\S]*?top:\s*90%;)/,
    );
    assert.match(
      globalsCss,
      /\.hero-mesh::after,[\s\S]*?\.pain-points-mesh::after\s*\{(?=[\s\S]*?right:\s*calc\(-10% - 300px\);)(?=[\s\S]*?top:\s*10%;)/,
    );
    assert.match(
      globalsCss,
      /\.hero-mesh::before,[\s\S]*?--halo:\s*var\(--ambient-mobile-leaf\);/,
    );
    assert.match(
      globalsCss,
      /\.hero-mesh::after,[\s\S]*?--halo:\s*var\(--ambient-mobile-mint\);/,
    );
    assert.doesNotMatch(
      globalsCss,
      /\.pain-points-mesh::after\s*\{[^}]*--halo:\s*var\(--ambient-mobile-leaf\);/,
    );
    assert.match(componentSources.painPoints, /pain-points-mesh/);
  });

  it("keeps the hero focused on one CTA without competing proof", () => {
    assert.match(componentSources.hero, /\bpb-12\b/);
    assert.match(componentSources.hero, /\bmd:pb-28\b/);
    // La citation de Julie vit dans Testimonials. La re-servir ici mettait les
    // mêmes mots deux fois sur la page, et poussait la preuve produit sous la
    // ligne de flottaison d'un portable en 900px de haut.
    assert.doesNotMatch(componentSources.hero, /<blockquote/);
    assert.doesNotMatch(joined(frDict.home.hero), /Julie D\./);
    assert.doesNotMatch(
      joined(frDict.home.hero),
      /dépenses que je ne voyais pas/,
    );
    assert.ok(
      frDict.home.testimonials.items.some((testimonial) =>
        /prévoir nos vacances sur l’année/.test(testimonial.highlight),
      ),
    );
    // Le surligneur porte la fin de la promesse, et rien d'autre.
    assert.match(
      componentSources.hero,
      /<mark className="marker-highlight marker-highlight-strong">\s*\{dict\.headlineHighlight\}\s*<\/mark>/,
    );
    assert.equal(frDict.home.hero.headlineHighlight, "combien il te restera.");
    assert.doesNotMatch(
      componentSources.hero,
      /marker-highlight[\s\S]*?<span className="text-primary">/,
    );
    assert.match(
      componentSources.hero,
      /\{dict\.subheadLead\}[\s\S]*<strong className="font-semibold text-text">\s*\{dict\.subheadEmphasis\}\s*<\/strong>\s*\{dict\.subheadTail\}/,
    );
    assert.match(frDict.home.hero.subheadLead, /^Planifie ton budget /);
    assert.equal(frDict.home.hero.subheadEmphasis, "sur l’année");
    assert.match(
      frDict.home.hero.subheadTail,
      /préparer tes projets plus sereinement/,
    );
    assert.doesNotMatch(componentSources.hero, /href="#how-it-works"/);
  });

  it("keeps the liquid-glass navbar readable over page content", () => {
    assert.match(
      componentSources.header,
      /scrolled:bg-surface\/80 scrolled:shadow-\[0_4px_30px_rgba\(0,0,0,0\.1\)\] scrolled:ring-white\/60 scrolled:backdrop-blur-\[14px\] scrolled:backdrop-saturate-150/,
    );
    assert.match(
      componentSources.header,
      /bg-white\/40 px-6 shadow-none ring-1 ring-transparent backdrop-blur-none/,
    );
    assert.match(
      componentSources.header,
      /transition-\[background-color,box-shadow\] duration-500/,
    );
    assert.match(
      componentSources.header,
      /href=\{link\.href\}[\s\S]*?className="[^"]*\btext-text\b[^"]*"/,
    );
  });

  it("drives the scrolled navbar without waiting for hydration", () => {
    assert.match(
      globalsCss,
      /@custom-variant scrolled \(html\[data-scrolled\] &\);/,
    );
    // The sentinel lives in the layout: rendering it again on client navigation
    // would orphan the IntersectionObserver and freeze `data-scrolled`.
    assert.match(componentSources.layout, /id=\{SCROLL_SENTINEL_ID\}/);
    assert.doesNotMatch(componentSources.header, /SCROLL_SENTINEL_ID/);
    assert.match(componentSources.layout, /toggleAttribute\('data-scrolled'/);
    assert.doesNotMatch(componentSources.header, /IntersectionObserver/);
  });

  it("extends the landing into the iOS safe area without hiding the header", () => {
    assert.match(
      componentSources.metadata,
      /export const rootViewport: Viewport = \{[\s\S]*themeColor: "#eaf6e6"[\s\S]*viewportFit: "cover"/,
    );
    // Les trois documents racines partagent la même fenêtre. Celui qui
    // l'oublierait ne se trahirait que sur un appareil à encoche.
    for (const [name, source] of Object.entries(rootDocuments)) {
      assert.match(source, /export const viewport = rootViewport;/, name);
    }
    assert.match(
      getDeclarations("html"),
      /background-color:\s*var\(--color-surface-alt\)/,
    );
    assert.doesNotMatch(
      getDeclarations("body"),
      /padding-top:\s*env\(safe-area-inset-top\)/,
    );
    assert.match(
      componentSources.hero,
      /pt-\[calc\(9rem\+env\(safe-area-inset-top\)\)\]/,
    );
    assert.match(
      componentSources.header,
      /top-\[calc\(env\(safe-area-inset-top\)\+0\.625rem\)\]/,
    );
    assert.match(
      globalsCss,
      /padding-inline:\s*env\(safe-area-inset-left\)\s+env\(safe-area-inset-right\)/,
    );
    assert.match(
      componentSources.header,
      /left-\[calc\(env\(safe-area-inset-left\)\+0\.625rem\)\][^"]*right-\[calc\(env\(safe-area-inset-right\)\+0\.625rem\)\]/,
    );
    assert.match(
      componentSources.header,
      /pl-\[max\(1rem,env\(safe-area-inset-left\)\)\][^"]*pr-\[max\(1rem,env\(safe-area-inset-right\)\)\]/,
    );
  });

  it("frames the problem and current alternatives before the solution", () => {
    assert.equal(
      frDict.home.painPoints.spreadsheet.title,
      "Avec un tableur, tu dois tout tenir à jour.",
    );
    assert.equal(
      frDict.home.painPoints.tracking.title,
      "Le suivi commence une fois l’argent dépensé.",
    );
    assert.doesNotMatch(componentSources.painPoints, /PROOFS = \[/);
    assert.match(
      frDict.home.painPoints.tracking.text,
      /dépense prévue en septembre tient encore dans ton budget/,
    );
    assert.match(
      componentSources.page,
      /<PainPoints dict=\{[^}]+\} \/>[\s\S]*<Solution\b/,
    );
  });

  it("turns future planning into a concrete tax scenario", () => {
    assert.match(
      frDict.home.painPoints.heading,
      /Les impôts tombent en juillet[\s\S]*combien il te restera en août/,
    );
  });

  it("shows how one typical month becomes a projected year", () => {
    // L'ordre des étapes et le visuel de chacune sont structurels ; leur titre
    // vient du catalogue.
    assert.match(
      componentSources.howItWorks,
      /STEP_IDS = \["template", "year", "month"\]/,
    );
    assert.match(
      componentSources.howItWorks,
      /template: MonthTemplateVisual,[\s\S]*year: YearSpreadVisual,[\s\S]*month: MonthAvailableVisual,/,
    );
    assert.equal(frDict.home.howItWorks.visuals.templateTitle, "Ton mois type");
    assert.equal(frDict.home.howItWorks.visuals.yearTitle, "Ton année");
    assert.match(componentSources.solution, /<HowItWorks dict=\{[^}]+\} \/>/);
  });

  it("gives the three planning visuals one shared frame", () => {
    assert.equal(
      componentSources.howItWorksVisuals.match(/<StepFrame /g)?.length,
      3,
    );
    assert.equal(
      componentSources.howItWorksVisuals.match(/function StepFrame\(/g)?.length,
      1,
    );
    assert.doesNotMatch(componentSources.howItWorks, /<Screenshot/);
  });

  it("keeps one arithmetic across the three planning visuals", () => {
    // Les trois visuels racontent le même mois : les parts de chaque barre
    // doivent redonner le revenu, et le juillet du graphe doit valoir le
    // disponible de l'étape 3. Éditer un nombre sans l'autre rendrait la démo
    // fausse pour un visiteur qui additionne.
    const body = (name: string) =>
      planningVisuals.match(
        new RegExp(`export function ${name}[\\s\\S]*?\\n}`),
      )?.[0] ?? "";
    const segmentTotal = (source: string) =>
      [...source.matchAll(/amount: (\d+)/g)].reduce(
        (total, [, amount]) => total + Number(amount),
        0,
      );
    assert.match(planningVisuals, /const INCOME = 3500/);
    assert.equal(segmentTotal(body("MonthTemplateVisual")), 3500);
    assert.equal(segmentTotal(body("MonthAvailableVisual")), 3500);
    assert.match(
      body("MonthTemplateVisual"),
      new RegExp(`<Payoff value=\\{${fullMonth}\\}`),
    );
    assert.match(body("MonthAvailableVisual"), /<Payoff value=\{500\}/);
    // Trois catégories annoncées par la copie, donc trois mois qui décrochent,
    // aux rangs de juillet, août et décembre, et la légende sous le graphe les
    // nomme toutes les trois.
    assert.deepEqual(
      monthAvailable(),
      [1400, 1400, 1400, 1400, 1400, 1400, 500, 700, 1400, 1400, 1400, 200],
    );
    const dips = monthAvailable().filter(
      (amount) => amount !== Number(fullMonth),
    );
    assert.equal(dips.length, 3);
    assert.equal(new Set(dips).size, 3);
    assert.equal(
      frDict.home.howItWorks.visuals.yearLegend,
      "Juillet, impôts · Août, vacances · Décembre, gros achat",
    );
  });

  it("makes the sr-only captions announce the amounts the visuals draw", () => {
    // Les figcaption énoncent en chiffres nus ce que les barres dessinent, et
    // rien ne les reliait : changer `INCOME` laissait la légende annoncer aux
    // lecteurs d'écran un montant que l'écran n'affiche plus. Les deux sources
    // sont comparées en ensembles, parce qu'une légende répète un montant que
    // le visuel ne porte qu'une fois.
    const amounts = (source: string, pattern: RegExp) =>
      [...source.matchAll(pattern)].map(([, amount]) => Number(amount));
    const body = (name: string) =>
      planningVisuals.match(
        new RegExp(`export function ${name}[\\s\\S]*?\\n}`),
      )?.[0] ?? "";
    const income = amounts(planningVisuals, /const INCOME = (\d+)/g);
    const composition = (name: string) => [
      ...income,
      ...amounts(body(name), /amount: (\d+)/g),
      ...amounts(body(name), /<Payoff value=\{(\d+)\}/g),
    ];
    const drawn = [
      composition("MonthTemplateVisual"),
      monthAvailable(),
      composition("MonthAvailableVisual"),
    ];

    // La légende est coupée autour de l'unité monétaire, qui suit le visiteur et
    // non la langue de la page : les deux morceaux se recollent pour être lus.
    // Les montants y sont écrits à la française, `3 500`, avec une espace.
    const steps = frDict.home.howItWorks.steps;
    const announced = (["template", "year", "month"] as const).map((id) =>
      amounts(
        `${steps[id].captionLead}${steps[id].captionTail}`.replace(
          /(\d)\s+(?=\d)/g,
          "$1",
        ),
        /(\d+)/g,
      ),
    );
    assert.match(
      componentSources.howItWorks,
      /captionLead\}\s*<CurrencyUnit \/>\s*\{dict\.steps\[id\]\.captionTail/,
    );

    const sorted = (values: number[]) =>
      [...new Set(values)].sort((left, right) => left - right);
    assert.equal(announced.length, 3);
    announced.forEach((caption, step) => {
      assert.deepEqual(
        sorted(caption),
        sorted(drawn[step]),
        `étape ${step + 1} : la légende annonce ${sorted(caption).join(", ")}, le visuel dessine ${sorted(drawn[step]).join(", ")}`,
      );
    });
  });

  it("presents the three setup steps as one scannable ordered process", () => {
    assert.match(
      componentSources.howItWorks,
      /<ol[\s\S]*md:grid-cols-3[\s\S]*steps\.map/,
    );
    assert.match(
      componentSources.howItWorks,
      /<li[\s\S]*<StepCopy[\s\S]*<figure[\s\S]*step\.visual/,
    );
    assert.match(
      componentSources.howItWorks,
      /inline-flex size-8[\s\S]*rounded-full[\s\S]*bg-primary/,
    );
    assert.doesNotMatch(componentSources.howItWorks, /md:grid-cols-12/);
    assert.doesNotMatch(componentSources.howItWorks, /lg:space-y-20/);
  });

  it("labels each step above its visual on mobile, below it on desktop", () => {
    // Le contrat est la bascule d'ordre, pas la liste de classes complète :
    // figer le littéral faisait échouer ce test sur l'ajout de `md:row-span-2`,
    // qui ne touche pas l'ordre de lecture.
    const stepCopyTag =
      componentSources.howItWorks.match(/<StepCopy[\s\S]*?\/>/)?.[0];
    assert.ok(stepCopyTag, "StepCopy is missing from HowItWorks");
    for (const token of [
      /md:order-2/,
      /\bmb-5\b/,
      /md:mb-0/,
      /md:mt-5/,
      /md:text-center/,
    ]) {
      assert.match(stepCopyTag, token);
    }
    const figureTag = componentSources.howItWorks.match(/<figure[^>]*>/)?.[0];
    assert.ok(figureTag, "The step figure is missing from HowItWorks");
    assert.match(figureTag, /md:order-1/);
    assert.match(
      componentSources.howItWorks,
      /flex items-center gap-3 md:flex-col/,
    );
    assert.match(componentSources.howItWorks, /\bpl-11\b/);
    assert.match(componentSources.howItWorks, /\bmd:pl-0\b/);
  });

  it("keeps accented display lines clear of descenders", () => {
    assert.match(
      componentSources.painPoints,
      /<h2[^>]*leading-\[1\.12\][^>]*>/,
    );
  });

  it("keeps the ambient page gradient continuous across full-width sections", () => {
    for (const source of [
      componentSources.howItWorks,
      componentSources.testimonials,
      componentSources.whyFree,
    ]) {
      assert.doesNotMatch(source, /<Section[\s\S]*?background="surface"/);
    }
  });

  it("avoids stacked full-width separators around social proof", () => {
    assert.doesNotMatch(
      componentSources.howItWorks,
      /<ol className="[^"]*border-y/,
    );
    assert.doesNotMatch(
      componentSources.testimonials,
      /<Section[\s\S]*?className="border-y/,
    );
    assert.doesNotMatch(
      componentSources.testimonials,
      /className="mt-6 grid border-y/,
    );
    assert.doesNotMatch(
      componentSources.whyFree,
      /<Section[\s\S]*?className="border-y/,
    );
  });

  it("keeps the desktop dashboard attached to the hero", () => {
    assert.match(componentSources.hero, /\blg:pb-20\b/);
    assert.match(componentSources.hero, /\bmd:pb-28\b/);
  });

  it("treats section spacing as a shared boundary instead of doubling it", () => {
    assert.match(componentSources.section, /\bpy-10\b/);
    assert.match(componentSources.section, /\blg:py-15\b/);
    assert.match(componentSources.section, /\bscroll-mt-24\b/);
    assert.doesNotMatch(componentSources.section, /\bpy-20\b/);
    assert.doesNotMatch(componentSources.section, /\blg:py-30\b/);
  });

  it("hides a collapsed accordion panel from assistive technology", () => {
    const html = renderToStaticMarkup(
      <AccordionItem question="Question" answer="Réponse" />,
    );

    // L'état ouvert, le clavier et l'annonce viennent désormais de `<details>`,
    // qui répond sans attendre l'hydratation. `invisible` remplace l'ancien
    // `aria-hidden` pour retirer le contenu replié de l'arbre d'accessibilité,
    // le `display: none` natif ne se transitionnant pas.
    assert.match(html, /^<details/);
    assert.match(html, /<summary/);
    assert.doesNotMatch(html, /\bopen\b=|<details open/);
    const panel = html.match(/<div class="[^"]*grid-rows-\[0fr\][^"]*"/)?.[0];
    assert.ok(panel, "Accordion collapsed panel is missing");
    assert.match(panel, /\binvisible\b/);
    assert.match(panel, /group-open:visible/);
  });

  it("keeps the accordion out of the client bundle", () => {
    assert.doesNotMatch(componentSources.accordionItem, /use client/);
    assert.doesNotMatch(componentSources.accordionItem, /useState/);
  });

  it("tracks every CTA through a single delegated listener", () => {
    // Un seul écouteur émet l'évènement. Si une section reposait encore son
    // propre `onClick` de suivi, chaque clic compterait deux fois.
    assert.match(
      componentSources.posthogProvider,
      /closest<HTMLElement>\(\s*"\[data-cta-name\]",?\s*\)/,
    );
    for (const source of [
      componentSources.header,
      componentSources.hero,
      componentSources.finalCta,
      componentSources.platforms,
      componentSources.stickyCta,
    ]) {
      assert.doesNotMatch(source, /trackCTAClick/);
      assert.match(source, /data-cta-name=/);
    }
  });

  it("propagates each landing locale through every webapp CTA", () => {
    for (const locale of LOCALES) {
      const url = angularUrl("/signup", "test", locale);
      assert.match(url, new RegExp(`[?&]lang=${locale}(?:&|$)`));
      assert.match(url, /[?&]utm_source=landing(?:&|$)/);
    }

    for (const source of [
      componentSources.header,
      componentSources.hero,
      componentSources.finalCta,
      componentSources.platforms,
      componentSources.stickyCta,
      componentSources.support,
    ]) {
      for (const call of source.matchAll(/angularUrl\([\s\S]*?\)/g)) {
        assert.match(call[0], /,\s*(?:locale|DEFAULT_LOCALE)\s*\)$/);
      }
    }
  });

  it("keeps sections that only tracked clicks out of the client bundle", () => {
    // La devise dépend du visiteur, mais elle ne concerne que les nœuds de
    // montant : la frontière client est descendue jusqu'à eux, donc les sections
    // qui les contiennent restent rendues côté serveur.
    for (const source of [
      componentSources.header,
      componentSources.finalCta,
      componentSources.platforms,
      componentSources.hero,
      componentSources.features,
      componentSources.howItWorks,
      componentSources.howItWorksVisuals,
    ]) {
      assert.doesNotMatch(source, /use client/);
    }
    // Ceux-là gardent React : maquette animée, montants du visiteur, observateur
    // de défilement.
    assert.match(componentSources.heroDashboard, /use client/);
    assert.match(componentSources.money, /use client/);
    assert.match(componentSources.stickyCta, /use client/);
  });

  it("transitions only the properties that change", () => {
    for (const [component, source] of Object.entries(componentSources)) {
      assert.doesNotMatch(
        source,
        /\btransition-all\b/,
        `${component} must not use transition-all`,
      );
    }
  });

  it("uses consistent press feedback and desktop navigation hit areas", () => {
    assert.doesNotMatch(componentSources.button, /active:scale-\[(?:0\.98)\]/);
    assert.doesNotMatch(
      componentSources.header,
      /active:scale-(?:95|\[0\.98\])/,
    );
    assert.match(componentSources.button, /active:scale-\[0\.96\]/);
    assert.match(componentSources.header, /min-h-11/);
  });

  it("keeps long CTAs inside narrow mobile viewports", () => {
    assert.match(componentSources.button, /\bmax-w-full\b/);
    assert.match(componentSources.button, /\bwhitespace-normal\b/);
    assert.match(componentSources.button, /\bsm:whitespace-nowrap\b/);
  });

  it("cross-fades both mobile menu icons without unmounting either icon", () => {
    assert.doesNotMatch(componentSources.header, /mobileMenuOpen \? <X/);
    assert.match(
      componentSources.header,
      /scale-\[0\.25\] opacity-0 blur-\[4px\]/,
    );
    assert.match(
      componentSources.header,
      /transition-\[opacity,filter,scale\]/,
    );
    assert.match(componentSources.header, /group-open:blur-\[4px\]/);
    assert.match(componentSources.header, /group-open:blur-none/);
    // `blur-0` est une classe Tailwind v3 : la v4 ne la génère pas et l'ignore
    // en silence, ce qui laissait la croix floutée une fois le menu ouvert.
    assert.doesNotMatch(componentSources.header, /[\s"]blur-0[\s"]/);
  });

  it("opens the mobile menu without waiting for hydration", () => {
    // `<details>`/`<summary>` associe nativement le bouton à son panneau et
    // annonce l'état ouvert : plus besoin d'`aria-controls` ni d'`aria-expanded`
    // pilotés à la main, et surtout le menu répond avant l'hydratation.
    assert.match(componentSources.header, /<details id=\{MOBILE_NAV_ID\}/);
    assert.match(componentSources.header, /<summary/);
    assert.match(
      componentSources.header,
      /aria-controls=\{MOBILE_NAV_PANEL_ID\}/,
    );
    assert.match(componentSources.header, /id=\{MOBILE_NAV_PANEL_ID\}/);
    assert.doesNotMatch(componentSources.header, /useState/);
    assert.doesNotMatch(componentSources.header, /onClick=\{\(\) => setMobile/);
    // Le panneau ne doit jamais retourner sous le `<nav>` de la barre : celui-ci
    // porte un `backdrop-filter` en état scrollé, ce qui en ferait un bloc
    // conteneur et casserait son `fixed inset-0`.
    assert.match(
      componentSources.header,
      /<\/nav>\s*\n[\s\S]*<details id=\{MOBILE_NAV_ID\}/,
    );
  });

  it("keeps the closed mobile panel out of the render tree", () => {
    assert.match(componentSources.header, /className="group peer"/);
    assert.match(
      componentSources.header,
      /<\/details>[\s\S]*?<nav\s+id=\{MOBILE_NAV_PANEL_ID\}/,
    );
    assert.match(componentSources.header, /\binert\b/);
    assert.match(componentSources.header, /aria-hidden="true"/);
    // Toutes les classes qui suivent se lisent sur le panneau lui-même. Portées
    // par n'importe quel `className` du fichier, elles passaient en le laissant
    // peint au repos — l'état même qui a causé le défaut.
    const panelClasses = componentSources.header.match(
      /<nav\s+id=\{MOBILE_NAV_PANEL_ID\}[^>]*?\sclassName="([^"]*)"/,
    )?.[1];
    assert.ok(panelClasses, "le panneau mobile doit porter un className");
    const panelHas = (token: string) =>
      panelClasses.split(/\s+/).includes(token);

    assert.ok(panelHas("fixed") && panelHas("h-screen"));
    // Replié, le panneau vaut `display: none`. `opacity: 0` le laisserait dans
    // l'arbre de rendu, où Safari 26 lit le fond des éléments fixes pour teinter
    // sa barre du bas : le bouton vert du menu, ancré en bas d'un panneau plein
    // écran, lui donnait son aplat sur toute la landing.
    assert.ok(panelHas("hidden"), "replié, le panneau doit quitter le rendu");
    // `max-lg:` et non `peer-open:` seul : `:is(:where(.peer):is([open])~*)` pèse
    // (0,2,0) contre (0,1,0) pour `lg:hidden`, qui perdrait donc sur un écran
    // large — le panneau resterait ouvert par-dessus la barre de bureau.
    assert.ok(
      panelHas("max-lg:peer-open:flex") && !panelHas("peer-open:flex"),
      "l'ouverture doit être bornée sous le point de rupture desktop",
    );
    assert.ok(panelHas("lg:hidden"));
    // Le fondu, que la bascule de `display` casserait sinon.
    assert.ok(
      panelHas("transition-[opacity,display]") &&
        panelHas("transition-discrete") &&
        panelHas("peer-open:starting:opacity-0"),
      "le fondu doit survivre à la bascule de display",
    );
    assert.ok(
      panelHas("pointer-events-none") &&
        panelHas("peer-open:pointer-events-auto") &&
        panelHas("peer-open:opacity-100"),
    );
    assert.equal(componentSources.header.match(/tabIndex=\{-1\}/g)?.length, 2);
    assert.doesNotMatch(componentSources.header, /\binvisible\b/);
    assert.doesNotMatch(componentSources.header, /\bbackdrop-blur-xl\b/);
    // Delegate to the document in capture mode (`toggle` does not bubble): the
    // Header renders again on client navigation, so an element listener would
    // become orphaned and leave the panel inert.
    assert.match(
      componentSources.layout,
      /panel\.inert=closed[\s\S]*setAttribute\('aria-hidden','true'\)[\s\S]*removeAttribute\('aria-hidden'\)[\s\S]*setAttribute\('tabindex','-1'\)[\s\S]*removeAttribute\('tabindex'\)[\s\S]*document\.addEventListener\('toggle',[\s\S]*\},true\)/,
    );
    assert.doesNotMatch(
      componentSources.layout,
      /nav\.addEventListener|panel\.addEventListener/,
    );
  });

  it("keeps landing analytics isolated from authenticated app identity", () => {
    assert.doesNotMatch(componentSources.posthogProvider, /getDistinctId/);
    assert.doesNotMatch(componentSources.posthogProvider, /ph_did/);
    assert.doesNotMatch(componentSources.posthog, /get_distinct_id/);
    assert.doesNotMatch(
      componentSources.posthog,
      /cross_subdomain_cookie:\s*true/,
    );
    assert.match(
      componentSources.posthog,
      /persistence_name:\s*POSTHOG_PERSISTENCE_NAME/,
    );
    assert.match(componentSources.posthog, /cross_subdomain_cookie:\s*false/);
    assert.match(componentSources.posthog, /Domain=\.pulpe\.app/);
    assert.match(componentSources.posthogProvider, /e\.preventDefault\(\)/);
    assert.match(componentSources.posthogProvider, /e\.button === 0/);
    assert.match(componentSources.posthogProvider, /!e\.metaKey/);
    assert.match(componentSources.posthogProvider, /!e\.ctrlKey/);
    assert.match(componentSources.posthogProvider, /!anchor\.download/);
    assert.match(
      componentSources.posthogProvider,
      /\(!anchor\.target \|\| anchor\.target === "_self"\)/,
    );
    assert.match(
      componentSources.posthogProvider,
      /window\.location\.assign\(href\)/,
    );
  });

  it("initializes isolated persistence before tracking and bounds slow CTA delivery", async () => {
    const originalEnabled = process.env.NEXT_PUBLIC_POSTHOG_ENABLED;
    const originalKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const originalWindow = Object.getOwnPropertyDescriptor(
      globalThis,
      "window",
    );
    const cookies = new Map([
      ["ph_test-landing-key_posthog", "legacy-identity"],
    ]);
    const fakeDocument = {
      get cookie() {
        return [...cookies]
          .map(([name, value]) => `${name}=${value}`)
          .join("; ");
      },
      set cookie(value: string) {
        const [pair, ...attributes] = value.split(";");
        const separator = pair.indexOf("=");
        const name = pair.slice(0, separator);
        const cookieValue = pair.slice(separator + 1);
        if (
          attributes.some((attribute) =>
            attribute.trim().toLowerCase().startsWith("max-age=0"),
          )
        ) {
          cookies.delete(name);
        } else {
          cookies.set(name, cookieValue);
        }
      },
    };

    process.env.NEXT_PUBLIC_POSTHOG_ENABLED = "true";
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "test-landing-key";
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        document: fakeDocument,
        location: {
          hostname: "pulpe.app",
        },
        clearTimeout,
        setTimeout,
      },
    });

    try {
      let nonce = 0;
      const importFresh = () =>
        import(
          `${new URL("../lib/posthog.ts", import.meta.url).href}?test=${nonce++}`
        ) as Promise<typeof import("../lib/posthog")>;

      let initOptions: Parameters<PostHog["init"]>[1];
      const captures: Parameters<PostHog["capture"]>[] = [];
      const registrations: Parameters<PostHog["register"]>[] = [];
      const posthog = {
        init: (_key: string, options: Parameters<PostHog["init"]>[1]) => {
          assert.equal(
            cookies.has("ph_test-landing-key_posthog"),
            false,
            "legacy identity must be removed before SDK init",
          );
          initOptions = options;
        },
        register: (...args: Parameters<PostHog["register"]>) => {
          registrations.push(args);
        },
        capture: (...args: Parameters<PostHog["capture"]>) => {
          captures.push(args);
          return undefined;
        },
      } as unknown as PostHog;

      const fast = await importFresh();
      await fast.initPostHog("de", async () => ({ default: posthog }));
      await fast.trackCTAClick("commencer", "hero", "/signup");

      assert.equal(initOptions?.persistence_name, "pulpe_landing");
      assert.equal(initOptions?.cross_subdomain_cookie, false);
      assert.deepEqual(registrations[0]?.[0], {
        environment: "local",
        locale: "de",
        platform: "landing",
      });
      assert.deepEqual(captures[0]?.[2], {
        send_instantly: true,
        transport: "sendBeacon",
      });

      const slow = await importFresh();
      slow.initPostHog("fr", () => new Promise(() => undefined));
      let trackingFinished = false;
      const tracking = slow
        .trackCTAClick("commencer", "hero", "/signup")
        .then(() => {
          trackingFinished = true;
        });
      await Promise.resolve();
      assert.equal(trackingFinished, false);
      const startedAt = performance.now();
      await tracking;
      assert.ok(performance.now() - startedAt < 1_000);

      const failed = await importFresh();
      const consoleError = console.error;
      console.error = () => undefined;
      try {
        const failedInit = failed.initPostHog("fr", async () => {
          throw new Error("module unavailable");
        });
        await Promise.all([
          failedInit,
          failed.trackCTAClick("commencer", "hero", "/signup"),
        ]);
        assert.equal(captures.length, 1);
      } finally {
        console.error = consoleError;
      }
    } finally {
      if (originalEnabled === undefined) {
        delete process.env.NEXT_PUBLIC_POSTHOG_ENABLED;
      } else {
        process.env.NEXT_PUBLIC_POSTHOG_ENABLED = originalEnabled;
      }
      if (originalKey === undefined) {
        delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
      } else {
        process.env.NEXT_PUBLIC_POSTHOG_KEY = originalKey;
      }
      if (originalWindow) {
        Object.defineProperty(globalThis, "window", originalWindow);
      } else {
        Reflect.deleteProperty(globalThis, "window");
      }
    }
  });

  it("uses targeted reduced-motion states", () => {
    assert.doesNotMatch(
      globalsCss,
      /(?:animation|transition)-duration:\s*0\.01ms/,
    );
    // Chaque animation porte sa propre sortie `motion-reduce:`, plutôt qu'un
    // interrupteur global qui couperait aussi les transitions utiles au repère.
    assert.match(
      componentSources.accordionItem,
      /motion-reduce:transition-none/,
    );
    assert.match(componentSources.header, /motion-reduce:transition-none/);
  });

  it("adds inset neutral outlines to the product surfaces", () => {
    // Le contrat survit à la disparition des captures : la surface qui tient
    // lieu de preuve produit ne flotte pas sans bord, qu'elle soit le tableau
    // de bord du hero ou les visuels de la section « comment ça marche ».
    assert.match(componentSources.heroDashboard, /outline-black\/10/);
    assert.match(componentSources.howItWorksVisuals, /outline-black\/5/);
  });

  it("keeps the mobile navigation non-modal and the page scrollable", () => {
    assert.doesNotMatch(componentSources.header, /lockBodyScroll/);
    assert.doesNotMatch(componentSources.header, /aria-modal/);
    assert.doesNotMatch(componentSources.header, /e\.key === ['"]Tab['"]/);
  });

  it("does not force pointer focus when the mobile navigation toggles", () => {
    assert.doesNotMatch(componentSources.header, /focusables\[0\]\?\.focus/);
    assert.doesNotMatch(
      componentSources.header,
      /else if \(wasOpen\.current\)/,
    );
  });

  it("dismisses the mobile navigation without waiting for hydration", () => {
    // Les fermetures automatiques vivent dans le script inline du layout, au
    // même titre que l'ouverture : sinon elles ne répondraient qu'après les
    // 3,2 s d'attente du bundle.
    const script = componentSources.layout;
    assert.match(
      script,
      /window\.addEventListener\('scroll',close,\{passive:true\}\)/,
    );
    assert.match(script, /e\.key!=='Escape'/);
    assert.match(script, /window\.innerWidth>=\$\{DESKTOP_BREAKPOINT_PX\}/);
    assert.match(script, /MOBILE_NAV_PANEL_ID\} a'\)\)close\(\)/);
    assert.doesNotMatch(componentSources.header, /addEventListener/);
  });

  it("keeps marketing content and product proof visible by default", () => {
    assert.doesNotMatch(componentSources.fadeIn, /IntersectionObserver/);
    assert.doesNotMatch(
      componentSources.fadeIn,
      /js-scroll-hidden|fade-in-view/,
    );
    assert.doesNotMatch(
      componentSources.heroDashboard,
      /animate-fade-in-scale/,
    );
    assert.doesNotMatch(
      globalsCss,
      /feTurbulence|cubic-bezier\(0\.34,\s*1\.56/,
    );
  });

  it("draws the CTA annotation once without hiding its fallback", () => {
    assert.match(componentSources.arrowNote, /IntersectionObserver/);
    assert.match(componentSources.arrowNote, /prefers-reduced-motion: reduce/);
    assert.match(componentSources.arrowNote, /observer\.disconnect\(\)/);
    assert.doesNotMatch(getDeclarations(".arrow-note-label"), /opacity:\s*0/);
    assert.match(
      getDeclarations(".arrow-note-ready .arrow-note-label"),
      /clip-path:\s*inset\(0 100% 0 0\)/,
    );
    assert.doesNotMatch(
      getDeclarations(".arrow-note-path"),
      /stroke-dashoffset:\s*1/,
    );
    assert.match(globalsCss, /\.arrow-note-ready \.arrow-note-label/);
    assert.match(globalsCss, /@media \(prefers-reduced-motion: reduce\)/);
  });

  it("pairs each of the three static setup steps with its own visual", () => {
    // Le numéro se dérive du rang dans `STEP_IDS` : trois étapes déclarées, donc
    // trois numéros, et aucun quatrième à oublier de renuméroter.
    assert.deepEqual(Object.keys(frDict.home.howItWorks.steps), [
      "template",
      "year",
      "month",
    ]);
    assert.match(componentSources.howItWorks, /number: String\(index \+ 1\)/);
    assert.doesNotMatch(componentSources.howItWorks, /IntersectionObserver/);
    for (const visual of [
      /template: MonthTemplateVisual/,
      /year: YearSpreadVisual/,
      /month: MonthAvailableVisual/,
    ]) {
      assert.equal(componentSources.howItWorks.match(visual)?.length, 1);
    }
    // Les visuels illustrent la phrase imprimée à côté d'eux : le figcaption
    // sr-only porte le contenu pour les lecteurs d'écran, le mock est masqué.
    assert.equal(
      componentSources.howItWorksVisuals.match(/aria-hidden="true"/g)?.length,
      1,
    );
    assert.equal(
      componentSources.howItWorks.match(/figcaption className="sr-only"/g)
        ?.length,
      1,
    );
    assert.match(componentSources.solution, /id="how-it-works"/);
  });

  it("places authentic testimonials after product proof with quote semantics", () => {
    assert.match(
      componentSources.page,
      /<Solution dict=\{[^}]+\}[^>]*\/>[\s\S]*<Testimonials dict=\{[^}]+\} \/>[\s\S]*<Platforms dict=\{[^}]+\}[^>]*\/>/,
    );
    assert.doesNotMatch(componentSources.page, /<HowItWorks\b/);
    assert.match(componentSources.testimonials, /<blockquote/);
    // Person names are not works: no <cite>, plain styled text instead.
    assert.doesNotMatch(componentSources.testimonials, /<cite/);
    // Les témoignages sont des propos rapportés : ils gardent le nom et la date
    // d'inscription de leur auteur dans les quatre langues, jamais réécrits.
    for (const catalog of Object.values(CATALOGS)) {
      assert.deepEqual(
        catalog.home.testimonials.items.map((item) => item.name),
        ["Ismaël S.", "Sylvie G.", "Julie D."],
      );
      assert.match(
        joined(catalog.home.testimonials.items.map((item) => item.since)),
        /2025[\s\S]*2026[\s\S]*2025/,
      );
    }
    assert.doesNotMatch(componentSources.testimonials, /carousel|autoPlay/);
    assert.doesNotMatch(componentSources.testimonials, /background="primary"/);
  });

  it("uses one scannable emphasis per testimonial without card chrome", () => {
    const testimonialMarkup = renderToStaticMarkup(
      <Testimonials dict={frDict.home.testimonials} />,
    );

    assert.match(
      globalsCss,
      /\.marker-highlight\s*\{[\s\S]*?background-image:\s*linear-gradient\(/,
    );
    assert.match(componentSources.solution, /marker-highlight/);
    assert.match(componentSources.solution, /marker-highlight-strong/);
    assert.match(globalsCss, /--color-marker-highlight:\s*#c2f3b5/);
    assert.match(globalsCss, /--color-marker-highlight-strong:\s*#aaec96/);
    assert.match(globalsCss, /--color-marker-highlight-proof:\s*#f4df8a/);
    assert.match(
      globalsCss,
      /\.marker-highlight\s*\{[\s\S]*?margin-inline:\s*-0\.1em;[\s\S]*?padding-inline:\s*0\.1em;[\s\S]*?border-radius:\s*0\.12em 0\.08em 0\.1em 0\.06em;[\s\S]*?176\.5deg[\s\S]*?background-size:\s*0% 0\.92em;[\s\S]*?background-position:\s*0 56%;/,
    );
    // Le biais de 3,5deg fait dériver la bande d'environ 19px sur une marque
    // de 300px, alors qu'une marque à 16px ne fait que 15px de haut. Des
    // arrêts trop rentrés laissaient 3px du coin bas-droit sans encre, donc
    // un trait qui décollait du dernier mot. Ne pas les resserrer.
    assert.match(
      globalsCss,
      /\.marker-highlight\s*\{[\s\S]*?transparent 4%,\s*var\(--marker-color\) 5%,\s*var\(--marker-color\) 95%,\s*transparent 96%/,
    );
    assert.match(
      globalsCss,
      /\.marker-highlight-strong\s*\{[\s\S]*?--marker-color:\s*var\(--color-marker-highlight-strong\);/,
    );
    assert.match(
      globalsCss,
      /\.marker-highlight-proof\s*\{[\s\S]*?--marker-color:\s*var\(--color-marker-highlight-proof\);[\s\S]*?color:\s*var\(--color-text\);/,
    );
    // Un seul passage surligné par témoignage, dans les quatre langues : la
    // traduction ne peut ni en ajouter un second ni laisser la marque vide.
    for (const catalog of Object.values(CATALOGS)) {
      assert.equal(catalog.home.testimonials.items.length, 3);
      for (const item of catalog.home.testimonials.items) {
        assert.ok(item.highlight.trim().length > 0);
      }
    }
    assert.equal(
      testimonialMarkup.match(
        /class="marker-highlight marker-highlight-proof"/g,
      )?.length,
      3,
    );
    assert.match(componentSources.testimonials, /grid[\s\S]*md:grid-cols-3/);
    assert.match(
      componentSources.testimonials,
      /dict\.items\.map[\s\S]*marker-highlight[\s\S]*font-semibold/,
    );
    assert.doesNotMatch(componentSources.testimonials, /leadTestimonial/);
    assert.doesNotMatch(
      componentSources.testimonials,
      /supportingTestimonials/,
    );
    assert.doesNotMatch(
      joined(frDict.home.testimonials),
      /Trois usages différents, un même résultat/,
    );
    assert.doesNotMatch(
      componentSources.testimonials,
      /rounded-\[var\(--radius-card\)\]/,
    );
  });

  it("ships a fresh large social preview for Open Graph and X", () => {
    assert.match(
      componentSources.metadata,
      /card: "summary_large_image"[\s\S]*images: socialImages\(locale, site\.socialImageAlt\)/,
    );
    assert.match(
      componentSources.metadata,
      /url: socialPreviewImage\(locale\),\s*width: 1200,\s*height: 630,\s*alt,/,
    );
    // Le français garde le nom d'origine : cette URL circule déjà dans des
    // partages, et la renommer y remplacerait la vignette par un carré vide.
    assert.equal(socialPreviewFile("fr"), "pulpe-social-preview.png");
    // Chaque langue a sa carte, écrite dans sa langue et présente sur le disque.
    for (const locale of LOCALES) {
      assert.ok(
        existsSync(
          new URL(`../public/${socialPreviewFile(locale)}`, import.meta.url),
        ),
        `carte sociale manquante pour ${locale}`,
      );
      assert.ok(CATALOGS[locale].site.socialCard.subhead.trim().length > 0);
      assert.ok(CATALOGS[locale].site.socialImageAlt.trim().length > 0);
    }
    // Le générateur lit le catalogue : plus une phrase française en dur, sinon
    // les trois autres cartes reviendraient au français sans rien casser.
    assert.match(
      componentSources.ogGenerator,
      /for \(const locale of LOCALES\)/,
    );
    assert.match(
      componentSources.ogGenerator,
      /children: dict\.site\.socialCard\.subhead/,
    );
    assert.match(
      componentSources.ogGenerator,
      /children: dict\.home\.dashboard\.title/,
    );
    assert.doesNotMatch(componentSources.ogGenerator, /Tableau de bord/);
    assert.match(
      componentSources.ogGenerator,
      /children: formatAmount\(\s*HERO_AVAILABLE,\s*OG_CURRENCY,?\s*\)/,
    );
    assert.doesNotMatch(
      componentSources.ogGenerator,
      /PRODUCT_SCREENSHOT|social-preview-screenshot/,
    );
    assert.match(componentSources.ogGenerator, /socialPreviewFile\(locale\)/);
    assert.match(componentSources.ogGenerator, /process\.exitCode = 1/);
  });

  it("shows the creator behind Pulpe without inventing additional social proof", () => {
    assert.match(componentSources.whyFree, /import Image from "next\/image"/);
    assert.match(componentSources.whyFree, /src="\/maxime-portrait\.webp"/);
    assert.equal(frDict.home.whyFree.portraitAlt, "Maxime, créateur de Pulpe");
  });

  it("keeps secondary planning tools after social proof", () => {
    assert.doesNotMatch(componentSources.page, /<Roadmap\b/);
    assert.match(
      componentSources.page,
      /<Testimonials dict=\{[^}]+\} \/>[\s\S]*<Features dict=\{[^}]+\} \/>[\s\S]*<Platforms dict=\{[^}]+\}[^>]*\/>/,
    );
    assert.match(
      joined(frDict.home.features),
      /Pulpe recalcule la suite[\s\S]*Répartis une grosse dépense[\s\S]*Avance vers ton objectif, même si un mois change/,
    );
    assert.doesNotMatch(componentSources.features, /ADJUSTMENTS/);
    assert.doesNotMatch(componentSources.features, /adjustments-heading/);
  });

  it("explains how savings goals adapt without implying silent changes", () => {
    const goal = frDict.home.features.goal;
    assert.match(
      goal.body,
      /Fixe une cible et une date[\s\S]*Tu vois les épargnes qui y contribuent[\s\S]*et peux répartir le reste sur les mois suivants/,
    );
    assert.equal(goal.mockDeadline, "Pour septembre");
    assert.doesNotMatch(joined(frDict.home.features), /Prévision liée/);
    assert.doesNotMatch(componentSources.features, /Juil\. · 0 CHF/);
    assert.equal(goal.mockRemaining, "Reste réparti");
    // Les parts viennent du même reste divisé par le nombre de mois affichés, et
    // ce nombre est écrit ici plutôt que lu du catalogue : une traduction qui
    // listerait trois mois ne peut plus fausser la part en silence. Le tuple du
    // catalogue oblige les quatre langues à en fournir exactement deux.
    assert.equal(goal.mockMonths.length, 2);
    assert.match(componentSources.features, /GOAL_MONTH_COUNT = 2/);
    assert.match(
      componentSources.features,
      /GOAL_REMAINING_SHARE = \(GOAL_TARGET - GOAL_SAVED\) \/ GOAL_MONTH_COUNT/,
    );
    assert.match(
      componentSources.features,
      /dict\.goal\.mockMonths\.map\([\s\S]*\{month\}[\s\S]*<Money value=\{GOAL_REMAINING_SHARE\} \/>/,
    );
    // La barre et son libellé disaient 65 % de leur côté, sans lien avec les
    // deux montants au-dessus d'eux.
    assert.match(
      componentSources.features,
      /GOAL_PROGRESS = Math\.round\(\(GOAL_SAVED \/ GOAL_TARGET\) \* 100\)/,
    );
    assert.match(
      componentSources.features,
      /width: `\$\{GOAL_PROGRESS\}%`[\s\S]*\{GOAL_PROGRESS\} %/,
    );
    assert.doesNotMatch(componentSources.features, /w-\[65%\]|>\s*65 %/);
    assert.match(
      componentSources.features,
      /<div className="mt-4 border-t border-primary\/15 pt-3">/,
    );
    assert.doesNotMatch(
      componentSources.features,
      /rounded-xl bg-surface px-3 py-3|bg-primary\/6 px-2\.5 py-2/,
    );
    assert.doesNotMatch(
      componentSources.features,
      /Pulpe (redistribue|répartit) automatiquement/,
    );
  });

  it("keeps the two primary planning tools side by side for faster scanning", () => {
    assert.doesNotMatch(
      componentSources.features,
      /mt-12 overflow-hidden rounded-\[var\(--radius-large\)\]/,
    );
    assert.match(
      componentSources.features,
      /mt-12 grid gap-5 md:grid-cols-\[1\.08fr_0\.92fr\]/,
    );
    assert.equal(
      componentSources.features.match(
        /<article className="flex h-full flex-col overflow-hidden rounded-\[var\(--radius-large\)\]/g,
      )?.length,
      2,
    );
    assert.doesNotMatch(
      componentSources.features,
      /aria-labelledby="adjustments-heading"/,
    );
  });

  it("keeps the planning-tools heading concise on every viewport", () => {
    assert.doesNotMatch(
      componentSources.features,
      /<header className="grid[^"]*lg:grid-cols-12/,
    );
    assert.doesNotMatch(
      componentSources.features,
      /Tu ajustes une dépense ou un projet\. Les mois suivants restent à jour/,
    );
    assert.match(
      componentSources.features,
      /text-\[clamp\(2rem,9vw,3rem\)\][\s\S]*sm:text-5xl/,
    );
    assert.match(
      componentSources.features,
      /grid grid-cols-2[\s\S]*min-\[360px\]:grid-cols-4/,
    );
  });

  it("keeps final conversion copy factual and aligned with metadata", () => {
    assert.doesNotMatch(componentSources.finalCta, /Julie|blockquote/);
    assert.match(joined(frDict.home.whyFree), /AES-256-GCM/);
    // L'algorithme est un fait technique, pas de la copie : les quatre langues
    // le nomment à l'identique.
    for (const catalog of Object.values(CATALOGS)) {
      assert.match(joined(catalog.home.whyFree), /AES-256-GCM/);
    }
    assert.match(
      frDict.site.titleDefault,
      /des mois d’avance combien il te restera/i,
    );
    assert.match(
      joined(frDict.home.finalCta),
      /Prépare ton année[\s\S]*Vois combien il te restera chaque mois/i,
    );
  });

  it("uses concrete, natural wording for the future available amount", () => {
    for (const slice of [
      frDict.home.hero,
      frDict.home.painPoints,
      frDict.home.howItWorks,
      frDict.home.finalCta,
      frDict.site,
    ]) {
      assert.doesNotMatch(joined(slice), /ce qu(?:’|')il te restera/i);
    }

    assert.equal(
      frDict.home.howItWorks.steps.month.title,
      "Vois combien il te restera",
    );
    assert.match(
      frDict.home.faq.heading,
      /Les questions qu(?:’|')on me pose le plus/,
    );
  });

  it("reuses the landing composition and accordion on the support page", () => {
    assert.match(componentSources.support, /href="#main-content"/);
    assert.match(componentSources.support, /<main id="main-content"/);
    assert.match(componentSources.support, /hero-mesh/);
    assert.match(componentSources.support, /max-w-3xl/);
    assert.match(componentSources.support, /<AccordionItem/);
    assert.match(componentSources.support, /<FinalCTA dict=\{[^}]+\}[^>]*\/>/);
    assert.doesNotMatch(componentSources.support, /<details|<summary/);
  });

  it("explains when to edit a model versus a monthly budget", () => {
    const guide = joined(frDict.guide);
    assert.match(guide, /base de départ/);
    assert.match(guide, /mois précis/);
    assert.match(guide, /Appliquer/);
    assert.match(guide, /modifiée manuellement/);
    assert.match(guide, /Changer uniquement ce mois/);
    // Le mot « catégorie » ne fait pas partie du vocabulaire produit : aucune
    // des quatre langues ne doit le réintroduire par la traduction.
    for (const catalog of Object.values(CATALOGS)) {
      assert.doesNotMatch(joined(catalog.guide), /catégor|categor|Kategori/i);
    }
    assert.doesNotMatch(componentSources.supportGuide, /<Image|next\/image/);
  });

  it("owns the guide social metadata instead of inheriting the homepage", () => {
    assert.match(
      componentSources.pageMetadata,
      /supportGuideMetadata[\s\S]*socialMetadata\(\{[\s\S]*path: alternates\.canonical/,
    );
    assert.match(
      componentSources.metadata,
      /openGraph:\s*\{[\s\S]*type: "article"/,
    );
    assert.match(
      componentSources.metadata,
      /twitter:\s*\{[\s\S]*card: "summary_large_image"/,
    );
  });

  it("owns support and changelog social metadata in every locale", async () => {
    for (const locale of LOCALES) {
      for (const [route, section, generate] of [
        ["/support", CATALOGS[locale].support, supportMetadata],
        ["/changelog", CATALOGS[locale].changelog, changelogMetadata],
      ] as const) {
        const metadata = await generate(locale);
        const title = `${section.metaTitle} | Pulpe`;
        const canonical = locale === "fr" ? route : `/${locale}${route}`;
        const images = [
          {
            url: socialPreviewImage(locale),
            width: 1200,
            height: 630,
            alt: CATALOGS[locale].site.socialImageAlt,
            type: "image/png",
          },
        ];

        assert.ok(metadata.openGraph && "type" in metadata.openGraph);
        assert.equal(metadata.openGraph.type, "website");
        assert.equal(metadata.openGraph?.title, title);
        assert.equal(metadata.openGraph?.description, section.metaDescription);
        assert.equal(metadata.openGraph?.url, canonical);
        assert.equal(metadata.openGraph?.locale, OPEN_GRAPH_LOCALE[locale]);
        assert.deepEqual(
          metadata.openGraph?.alternateLocale,
          openGraphAlternates(locale),
        );
        assert.deepEqual(metadata.openGraph?.images, images);
        assert.equal(metadata.twitter?.title, title);
        assert.equal(metadata.twitter?.description, section.metaDescription);
        assert.deepEqual(metadata.twitter?.images, images);
      }
    }
  });

  it("links the first help journey from support and navigation", () => {
    // « Guides » et « Aide » se marchent dessus pour un visiteur : l'éditorial
    // s'appelle « Conseils budget », l'aide parle de tutoriels.
    assert.match(frDict.support.guidesHeading, /Bien démarrer avec Pulpe/);
    assert.doesNotMatch(frDict.support.guidesHeading, /Guides pour utiliser/);
    assert.equal(frDict.footer.links.support, "FAQ et tutoriels");
    // Les conseils budget n'existent qu'en français : leur libellé vit dans le
    // code, et le lien se retire des trois autres langues.
    assert.match(
      componentSources.footer,
      /id: "guides",\s*href: ADVICE_INDEX_ROUTE,[\s\S]*frenchOnly: true/,
    );
    assert.match(componentSources.support, /\/support\/modeles-et-budgets/);
    // La destination est structurelle et reste dans le code ; seul le libellé
    // change de langue, et les quatre catalogues doivent en fournir un.
    assert.match(
      componentSources.header,
      /\{ id: "support", href: "\/support" \}/,
    );
    assert.match(
      componentSources.footer,
      /\{ id: "support", href: "\/support", internal: true \}/,
    );
    for (const catalog of Object.values(CATALOGS)) {
      assert.ok(catalog.header.nav.support.trim().length > 0);
      assert.ok(catalog.footer.links.support.trim().length > 0);
    }
  });

  it("keeps skip links keyboard-only and moves focus to main content", () => {
    for (const source of [
      componentSources.page,
      componentSources.support,
      componentSources.supportGuide,
      componentSources.guidesIndex,
      componentSources.articleLayout,
    ]) {
      const skipLinkClass = source.match(
        /href="#main-content"\s+className="([^"]+)"/,
      )?.[1];

      assert.ok(skipLinkClass, "Skip link classes are missing");
      assert.match(skipLinkClass, /focus-visible:not-sr-only/);
      assert.doesNotMatch(skipLinkClass, /(?:^|\s)focus:/);
      const mainOpenTag = source.match(/<main[^>]*>/)?.[0];
      assert.ok(mainOpenTag, "Main landmark is missing");
      assert.match(mainOpenTag, /id="main-content"/);
      assert.match(mainOpenTag, /tabIndex=\{-1\}/);
      assert.ok(
        source.indexOf('href="#main-content"') < source.indexOf("<Header"),
      );
    }
  });

  it("keeps guides copy free of em and en dashes", () => {
    for (const source of [
      componentSources.guidesIndex,
      componentSources.guideArticle,
      componentSources.articleLayout,
    ]) {
      assert.doesNotMatch(source, /—|–/);
    }
  });

  it("keeps audited support details polished on mobile and keyboard", () => {
    assert.match(
      componentSources.accordionItem,
      /focus:outline-none[^"]*focus-visible:ring-2[^"]*focus-visible:ring-inset[^"]*focus-visible:ring-primary/,
    );
    assert.match(componentSources.layout, /<html[^>]*suppressHydrationWarning/);

    const questions = supportFaq(frDict).map((entry) => entry.question);
    assert.equal(questions.length, 9);
    // L'insécable fine devant le `?` est une règle française : les trois autres
    // langues ne la portent pas, et la compter ici évite qu'elle disparaisse
    // d'une question au fil d'une relecture.
    assert.ok(questions.every((question) => question.endsWith("\u202f?")));
    assert.ok(questions.includes("Ça marche en Suisse et en France\u202f?"));
    assert.match(frDict.support.intro, /Si la tienne manque, écris-moi\./);
    assert.doesNotMatch(
      frDict.support.intro,
      /Si la tienne manque, écris-moi directement\./,
    );
  });

  it("keeps support answers factual and aligned with the landing FAQ", () => {
    assert.equal(supportFaq(frDict).length, 9);

    // La FAQ de la page d'accueil et celle du support répondent la même chose :
    // les deux catalogues portent les mêmes faits, mot pour mot.
    for (const source of [
      joined(frDict.support.faq),
      joined(frDict.home.faq),
    ]) {
      assert.match(source, /prestataires externes/);
      assert.match(source, /contraintes réglementaires/);
      assert.match(source, /coût est trop élevé/);
      assert.match(source, /saisie reste manuelle/);
      assert.match(source, /deux clés conservées séparément/);
      assert.match(source, /dérivée de (?:ton|votre) code PIN/);
      assert.match(source, /fuite de la base seule/);
      assert.match(source, /AES-256-GCM/);
      assert.match(source, /déchiffrés côté serveur/);
      assert.match(
        source,
        /montants et libellés financiers ne sont ni transmis à des fins publicitaires ni revendus/,
      );
      assert.doesNotMatch(
        source,
        /choix délibéré|banques et les armées|zero-knowledge|—|–/,
      );
    }

    assert.match(componentSources.support, /mainEntity: faqs\.map/);
    assert.match(componentSources.support, /text: faq\.plainAnswer/);
    // Aucune traduction ne doit promettre plus que le produit ne tient : le
    // chiffrement est en base, déchiffré côté serveur, jamais de bout en bout.
    for (const catalog of Object.values(CATALOGS)) {
      assert.doesNotMatch(
        joined(catalog.support.faq),
        /bout en bout|end-to-end|Ende-zu-Ende|end to end|punto a punto|zero-knowledge/i,
      );
    }
  });

  it("keeps support links accessible and answer copy canonical", () => {
    assert.match(
      componentSources.support,
      /angularUrl\("\/settings", "faq_delete_account", locale\)/,
    );
    // Le texte nu du JSON-LD est recollé des trois morceaux de la réponse au
    // lieu d'être rédigé une seconde fois : les deux versions ne peuvent plus
    // diverger, et il n'y a plus rien à comparer ici.
    assert.match(
      componentSources.support,
      /plainAnswer: `\$\{entry\.answerBefore\}\$\{entry\.answerLink\}\$\{entry\.answerAfter\}`/,
    );
    assert.match(componentSources.support, /answer: ReactNode;/);
    assert.match(componentSources.support, /answer=\{faq\.answer\}/);
    assert.equal(
      componentSources.support.match(/inline-flex min-h-11 items-center/g)
        ?.length,
      2,
    );
    assert.doesNotMatch(
      componentSources.support,
      /const linkClass\s*=\s*"[^"]*min-h-11/,
    );
    assert.equal(
      componentSources.support.match(/linkedFaq\(faq\./g)?.length,
      4,
    );

    // La destination de chaque lien vit dans le code, son libellé dans le
    // catalogue : une traduction ne peut pas déplacer un lien, et un lien ne
    // peut pas se retrouver sans texte.
    for (const linkedAnswer of [
      {
        key: "trust",
        wiring:
          /linkedFaq\(faq\.trust, \{ href: GITHUB_URL, external: true \}\)/,
        facts: [
          "Tes montants ne sont jamais stockés en clair.",
          "deux clés conservées séparément",
          "code source est public",
        ],
      },
      {
        key: "demo",
        wiring:
          /linkedFaq\(faq\.demo, \{[\s\S]*angularUrl\("\/welcome", "faq_demo", locale\)[\s\S]*\}\)/,
        facts: [
          "mode démo",
          "utiliser Pulpe sans compte",
          "sans saisir tes propres",
        ],
      },
      {
        key: "free",
        wiring:
          /linkedFaq\(faq\.free, \{ href: GITHUB_URL, external: true \}\)/,
        facts: [
          "Pulpe est gratuit, sans publicité ni abonnement.",
          "projet solo",
          "code source est public",
        ],
      },
      {
        key: "deletion",
        wiring:
          /linkedFaq\(faq\.deletion, \{[\s\S]*angularUrl\("\/settings", "faq_delete_account", locale\)[\s\S]*\}\)/,
        facts: [
          "demander la suppression",
          "paramètres",
          "programmés pour être supprimés dans trois jours",
          "supprimés des systèmes actifs",
          "sauvegardes techniques",
          "politique de rétention",
        ],
      },
    ] as const) {
      assert.match(componentSources.support, linkedAnswer.wiring);

      const entry = frDict.support.faq[linkedAnswer.key];
      assert.ok(entry.answerLink.trim().length > 0);
      const text = answerText(entry);
      for (const fact of linkedAnswer.facts) {
        assert.ok(
          text.includes(fact),
          `la réponse « ${linkedAnswer.key} » ne dit plus « ${fact} »`,
        );
      }

      // Les trois autres langues gardent le lien, sans reprendre le français.
      for (const [code, catalog] of Object.entries(CATALOGS)) {
        const translated = catalog.support.faq[linkedAnswer.key];
        assert.ok(
          translated.answerLink.trim().length > 0,
          `${code} : le libellé du lien « ${linkedAnswer.key} » est vide`,
        );
      }
    }
  });

  it("keeps final CTA supporting copy legible over the ambient field", () => {
    assert.match(componentSources.finalCta, /max-w-2xl[^"\n]*text-text\/80/);
    assert.doesNotMatch(
      componentSources.finalCta,
      /max-w-2xl[^"\n]*text-text-secondary/,
    );
  });

  it("keeps enough leading between the final CTA headline lines", () => {
    assert.match(componentSources.finalCta, /leading-\[1\.12\]/);
    assert.doesNotMatch(
      componentSources.finalCta,
      /leading-\[(?:0\.98|1\.05)\]/,
    );
  });

  it("keeps the footer grouped into titled columns with tappable links", () => {
    assert.match(
      componentSources.footer,
      /lg:flex-row lg:items-start lg:justify-between/,
    );
    assert.deepEqual(Object.keys(frDict.footer.groups), [
      "discover",
      "help",
      "legal",
    ]);
    for (const catalog of Object.values(CATALOGS)) {
      for (const title of Object.values(catalog.footer.groups)) {
        assert.ok(title.trim().length > 0);
      }
    }
    assert.match(componentSources.footer, /\{dict\.groups\[group\.id\]\}/);
    assert.match(componentSources.footer, /min-h-11 items-center/);
  });

  it("propagates the landing locale through both legal links", () => {
    for (const locale of LOCALES) {
      const catalog = CATALOGS[locale];
      const html = renderToStaticMarkup(
        <Footer
          dict={catalog.footer}
          language={catalog.language}
          locale={locale}
          route={null}
        />,
      );
      const legalHrefs = [
        ...html.matchAll(/href="([^"]*\/legal\/[^"]+)"/g),
      ].map(([, href]) => href.replaceAll("&amp;", "&"));

      assert.deepEqual(legalHrefs, [
        angularUrl("/legal/cgu", "footer_terms", locale),
        angularUrl("/legal/confidentialite", "footer_privacy", locale),
      ]);
      for (const href of legalHrefs) {
        assert.equal(href.match(/[?&]lang=/g)?.length, 1);
        assert.match(href, new RegExp(`[?&]lang=${locale}$`));
      }
    }
  });
});
