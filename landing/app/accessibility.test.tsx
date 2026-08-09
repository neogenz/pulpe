import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { PostHog } from "posthog-js/dist/module.slim";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Testimonials } from "../components/sections/Testimonials";
import { AccordionItem } from "../components/ui/AccordionItem";

Object.assign(globalThis, { React });

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
  page: readFileSync(new URL("./page.tsx", import.meta.url), "utf8"),
  support: readFileSync(new URL("./support/page.tsx", import.meta.url), "utf8"),
  supportGuide: readFileSync(
    new URL("./support/modeles-et-budgets/page.tsx", import.meta.url),
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
  roadmap: readFileSync(
    new URL("../components/sections/Roadmap.tsx", import.meta.url),
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
  layout: readFileSync(new URL("./layout.tsx", import.meta.url), "utf8"),
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
    assert.doesNotMatch(componentSources.hero, /Julie D\./);
    assert.match(
      componentSources.testimonials,
      /prévoir nos vacances sur l’année/,
    );
    assert.match(
      componentSources.hero,
      /<mark className="marker-highlight marker-highlight-strong">\s*combien il te restera\.\s*<\/mark>/,
    );
    assert.doesNotMatch(
      componentSources.hero,
      /marker-highlight[\s\S]*?<span className="text-primary">/,
    );
    assert.match(
      componentSources.hero,
      /Planifie ton budget[\s\S]*<strong className="font-semibold text-text">\s*sur l&apos;année\s*<\/strong>[\s\S]*préparer tes\s*projets plus sereinement/,
    );
    assert.doesNotMatch(componentSources.hero, /dépenses que je ne voyais pas/);
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
    assert.match(componentSources.header, /id=\{SCROLL_SENTINEL_ID\}/);
    assert.match(componentSources.layout, /toggleAttribute\('data-scrolled'/);
    assert.doesNotMatch(componentSources.header, /IntersectionObserver/);
  });

  it("extends the landing into the iOS safe area without hiding the header", () => {
    assert.match(
      componentSources.layout,
      /export const viewport: Viewport = \{[\s\S]*themeColor: "#eaf6e6"[\s\S]*viewportFit: "cover"/,
    );
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
    assert.match(
      componentSources.painPoints,
      /LIMITS = \[[\s\S]*Avec un tableur, tu dois tout tenir à jour[\s\S]*Le suivi commence une fois l’argent dépensé/,
    );
    assert.doesNotMatch(componentSources.painPoints, /PROOFS = \[/);
    assert.match(
      componentSources.painPoints,
      /dépense prévue en septembre tient encore dans ton budget/,
    );
    assert.match(componentSources.page, /<PainPoints \/>[\s\S]*<Solution \/>/);
  });

  it("turns future planning into a concrete tax scenario", () => {
    assert.match(
      componentSources.painPoints,
      /Les impôts tombent en juillet[\s\S]*combien il te restera en\s+août/,
    );
  });

  it("shows how one typical month becomes a projected year", () => {
    assert.match(
      componentSources.howItWorks,
      /Ton mois type[\s\S]*<MonthTemplateVisual \/>[\s\S]*Ton année[\s\S]*<YearSpreadVisual \/>/,
    );
    assert.match(componentSources.solution, /<HowItWorks \/>/);
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
    assert.match(planningVisuals, /key: "jul", initial: "J", available: 500/);
    assert.match(planningVisuals, /key: "aou", initial: "A", available: 700/);
    assert.match(planningVisuals, /key: "dec", initial: "D", available: 200/);
    // Trois catégories annoncées par la copie, donc trois mois qui décrochent,
    // et la légende sous le graphe les nomme toutes les trois.
    const dips = [
      ...planningVisuals.matchAll(
        new RegExp(`available: (?!${fullMonth})(\\d+)`, "g"),
      ),
    ];
    assert.equal(dips.length, 3);
    assert.equal(new Set(dips.map(([, amount]) => amount)).size, 3);
    assert.match(
      planningVisuals,
      /Juillet, impôts · Août, vacances · Décembre, gros achat/,
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
      [
        Number(fullMonth),
        ...amounts(
          planningVisuals,
          new RegExp(`available: (?!${fullMonth})(\\d+)`, "g"),
        ),
      ],
      composition("MonthAvailableVisual"),
    ];

    // Les montants des légendes sont écrits à la française, `3 500`, et le
    // rewrapping de Prettier peut poser le séparateur sur une fin de ligne.
    const announced = [
      ...componentSources.howItWorks.matchAll(
        /caption: \(([\s\S]*?)\),\s*content:/g,
      ),
    ].map(([, caption]) =>
      amounts(caption.replace(/(\d)\s+(?=\d)/g, "$1"), /(\d+)/g),
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
      /<ol[\s\S]*md:grid-cols-3[\s\S]*STEPS\.map/,
    );
    assert.match(
      componentSources.howItWorks,
      /<li[\s\S]*<StepCopy[\s\S]*<figure[\s\S]*step\.image\.content/,
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
    assert.match(
      componentSources.layout,
      /panel\.inert=closed[\s\S]*setAttribute\('aria-hidden','true'\)[\s\S]*removeAttribute\('aria-hidden'\)[\s\S]*setAttribute\('tabindex','-1'\)[\s\S]*removeAttribute\('tabindex'\)[\s\S]*nav\.addEventListener\('toggle',syncPanel\)/,
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
      const posthog = {
        init: (_key: string, options: Parameters<PostHog["init"]>[1]) => {
          assert.equal(
            cookies.has("ph_test-landing-key_posthog"),
            false,
            "legacy identity must be removed before SDK init",
          );
          initOptions = options;
        },
        register: () => undefined,
        capture: (...args: Parameters<PostHog["capture"]>) => {
          captures.push(args);
          return undefined;
        },
      } as unknown as PostHog;

      const fast = await importFresh();
      await fast.initPostHog(async () => ({ default: posthog }));
      await fast.trackCTAClick("commencer", "hero", "/signup");

      assert.equal(initOptions?.persistence_name, "pulpe_landing");
      assert.equal(initOptions?.cross_subdomain_cookie, false);
      assert.deepEqual(captures[0]?.[2], {
        send_instantly: true,
        transport: "sendBeacon",
      });

      const slow = await importFresh();
      slow.initPostHog(() => new Promise(() => undefined));
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
        const failedInit = failed.initPostHog(async () => {
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
    assert.match(componentSources.roadmap, /motion-safe:animate-pulse/);
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
    assert.match(componentSources.howItWorks, /number: "1"/);
    assert.match(componentSources.howItWorks, /number: "2"/);
    assert.match(componentSources.howItWorks, /number: "3"/);
    assert.doesNotMatch(componentSources.howItWorks, /number: "4"/);
    assert.doesNotMatch(componentSources.howItWorks, /IntersectionObserver/);
    for (const visual of [
      /<MonthTemplateVisual \/>/,
      /<YearSpreadVisual \/>/,
      /<MonthAvailableVisual \/>/,
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
      /<Solution \/>[\s\S]*<Testimonials \/>[\s\S]*<Platforms \/>/,
    );
    assert.doesNotMatch(componentSources.page, /<HowItWorks \/>/);
    assert.match(componentSources.testimonials, /<blockquote/);
    // Person names are not works: no <cite>, plain styled text instead.
    assert.doesNotMatch(componentSources.testimonials, /<cite/);
    assert.match(componentSources.testimonials, /Ismaël/);
    assert.match(
      componentSources.testimonials,
      /depuis novembre 2025[\s\S]*depuis mai 2026[\s\S]*depuis décembre 2025/,
    );
    assert.doesNotMatch(componentSources.testimonials, /carousel|autoPlay/);
    assert.doesNotMatch(componentSources.testimonials, /background="primary"/);
  });

  it("uses one scannable emphasis per testimonial without card chrome", () => {
    const testimonialMarkup = renderToStaticMarkup(<Testimonials />);

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
    assert.equal(
      componentSources.testimonials.match(/highlight: "/g)?.length,
      3,
    );
    assert.equal(
      testimonialMarkup.match(
        /class="marker-highlight marker-highlight-proof"/g,
      )?.length,
      3,
    );
    assert.match(componentSources.testimonials, /grid[\s\S]*md:grid-cols-3/);
    assert.match(
      componentSources.testimonials,
      /TESTIMONIALS\.map[\s\S]*marker-highlight[\s\S]*font-semibold/,
    );
    assert.doesNotMatch(componentSources.testimonials, /leadTestimonial/);
    assert.doesNotMatch(
      componentSources.testimonials,
      /supportingTestimonials/,
    );
    assert.doesNotMatch(
      componentSources.testimonials,
      /Trois usages différents, un même résultat/,
    );
    assert.doesNotMatch(
      componentSources.testimonials,
      /rounded-\[var\(--radius-card\)\]/,
    );
  });

  it("ships a fresh large social preview for Open Graph and X", () => {
    assert.match(
      componentSources.layout,
      /const SOCIAL_PREVIEW_IMAGE = "\/pulpe-social-preview\.png\?v=2";/,
    );
    assert.equal(
      componentSources.layout.match(/url: SOCIAL_PREVIEW_IMAGE/g)?.length,
      2,
    );
    assert.match(
      componentSources.layout,
      /twitter:[\s\S]*card: "summary_large_image"[\s\S]*images: \[[\s\S]*url: SOCIAL_PREVIEW_IMAGE,[\s\S]*alt: SOCIAL_PREVIEW_ALT,[\s\S]*width: 1200,[\s\S]*height: 630/,
    );
    assert.match(
      componentSources.ogGenerator,
      /const HERO_HEADLINE = "Tu sais des mois à l’avance";/,
    );
    assert.match(
      componentSources.ogGenerator,
      /const HERO_MARKER = "combien il te restera\.";/,
    );
    assert.match(componentSources.ogGenerator, /Tableau de bord/);
    assert.match(componentSources.ogGenerator, /Disponible ce mois/);
    assert.match(componentSources.ogGenerator, /Vue annuelle/);
    assert.match(
      componentSources.ogGenerator,
      /children: formatAmount\(\s*HERO_AVAILABLE,\s*OG_CURRENCY,?\s*\)/,
    );
    assert.doesNotMatch(
      componentSources.ogGenerator,
      /PRODUCT_SCREENSHOT|social-preview-screenshot/,
    );
    assert.match(componentSources.ogGenerator, /pulpe-social-preview\.png/);
    assert.match(componentSources.ogGenerator, /process\.exitCode = 1/);
  });

  it("shows the creator behind Pulpe without inventing additional social proof", () => {
    assert.match(componentSources.whyFree, /import Image from "next\/image"/);
    assert.match(componentSources.whyFree, /src="\/maxime-portrait\.webp"/);
    assert.match(componentSources.whyFree, /Maxime, créateur de Pulpe/);
  });

  it("keeps secondary planning tools after social proof", () => {
    assert.doesNotMatch(componentSources.page, /<Roadmap \/>/);
    assert.match(
      componentSources.page,
      /<Testimonials \/>[\s\S]*<Features \/>[\s\S]*<Platforms \/>/,
    );
    assert.match(
      componentSources.features,
      /Pulpe recalcule la suite[\s\S]*Répartis une grosse dépense[\s\S]*Avance vers ton objectif, même si un mois change/,
    );
    assert.doesNotMatch(componentSources.features, /ADJUSTMENTS/);
    assert.doesNotMatch(componentSources.features, /adjustments-heading/);
  });

  it("explains how savings goals adapt without implying silent changes", () => {
    assert.match(
      componentSources.features,
      /Fixe une cible et une date[\s\S]*Tu vois les épargnes qui y contribuent[\s\S]*et peux répartir le reste sur les mois suivants/,
    );
    assert.match(componentSources.features, /Pour septembre/);
    assert.doesNotMatch(componentSources.features, /Prévision liée/);
    assert.doesNotMatch(componentSources.features, /Juil\. · 0 CHF/);
    assert.match(componentSources.features, /Reste réparti/);
    // Les parts viennent du même reste divisé par le nombre de mois listés, et
    // les mois sont la liste elle-même : la maquette ne peut plus afficher deux
    // montants qui ne s'accordent pas, ni un mois de plus que ce qu'elle divise.
    assert.match(
      componentSources.features,
      /GOAL_MONTHS: readonly \[string, string\] = \["Août", "Sept\."\]/,
    );
    assert.match(
      componentSources.features,
      /GOAL_REMAINING_SHARE = \(GOAL_TARGET - GOAL_SAVED\) \/ GOAL_MONTHS\.length/,
    );
    assert.match(
      componentSources.features,
      /GOAL_MONTHS\.map\([\s\S]*\{month\}[\s\S]*<Money value=\{GOAL_REMAINING_SHARE\} \/>/,
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
    assert.match(componentSources.whyFree, /AES-256-GCM/);
    assert.match(
      componentSources.layout,
      /des mois d’avance combien il te restera/i,
    );
    assert.match(
      componentSources.finalCta,
      /Prépare ton année[\s\S]*Vois combien il te restera chaque mois/i,
    );
  });

  it("uses concrete, natural wording for the future available amount", () => {
    for (const source of [
      componentSources.hero,
      componentSources.painPoints,
      componentSources.howItWorks,
      componentSources.finalCta,
      componentSources.layout,
    ]) {
      assert.doesNotMatch(source, /ce qu(?:’|&apos;)il te restera/i);
    }

    assert.match(
      componentSources.howItWorks,
      /title: "Vois combien il te restera"/,
    );
    assert.match(
      componentSources.faq,
      /Les questions qu&apos;on me pose le plus/,
    );
  });

  it("reuses the landing composition and accordion on the support page", () => {
    assert.match(componentSources.support, /href="#main-content"/);
    assert.match(componentSources.support, /<main id="main-content"/);
    assert.match(componentSources.support, /hero-mesh/);
    assert.match(componentSources.support, /max-w-3xl/);
    assert.match(componentSources.support, /<AccordionItem/);
    assert.match(componentSources.support, /<FinalCTA \/>/);
    assert.doesNotMatch(componentSources.support, /<details|<summary/);
  });

  it("explains when to edit a model versus a monthly budget", () => {
    assert.match(componentSources.supportGuide, /base de départ/);
    assert.match(componentSources.supportGuide, /mois précis/);
    assert.match(componentSources.supportGuide, /Appliquer/);
    assert.match(componentSources.supportGuide, /modifiée manuellement/);
    assert.match(componentSources.supportGuide, /Changer uniquement ce mois/);
    assert.doesNotMatch(componentSources.supportGuide, /catégor/i);
    assert.doesNotMatch(componentSources.supportGuide, /<Image|next\/image/);
  });

  it("owns the guide social metadata instead of inheriting the homepage", () => {
    assert.match(componentSources.supportGuide, /const GUIDE_PATH/);
    assert.match(componentSources.supportGuide, /openGraph:\s*\{/);
    assert.match(componentSources.supportGuide, /url: GUIDE_PATH/);
    assert.match(componentSources.supportGuide, /twitter:\s*\{/);
  });

  it("links the first help journey from support and navigation", () => {
    assert.match(componentSources.support, /Guides pour utiliser Pulpe/);
    assert.match(componentSources.support, /\/support\/modeles-et-budgets/);
    assert.match(componentSources.header, /href: "\/support", label: "Aide"/);
    assert.match(componentSources.footer, /label: "Aide", href: "\/support"/);
  });

  it("keeps skip links keyboard-only and moves focus to main content", () => {
    for (const source of [
      componentSources.page,
      componentSources.support,
      componentSources.supportGuide,
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

  it("keeps audited support details polished on mobile and keyboard", () => {
    assert.match(
      componentSources.accordionItem,
      /focus:outline-none[^"]*focus-visible:ring-2[^"]*focus-visible:ring-inset[^"]*focus-visible:ring-primary/,
    );
    assert.match(componentSources.layout, /<html[^>]*suppressHydrationWarning/);

    const questions = [
      ...componentSources.support.matchAll(/question: "([^"]+)"/g),
    ].map((match) => match[1]);
    assert.equal(questions.length, 9);
    assert.ok(questions.every((question) => question.endsWith("\u202f?")));
    assert.ok(questions.includes("Ça marche en Suisse et en France\u202f?"));
    assert.match(componentSources.support, /Si la tienne manque, écris-moi\./);
    assert.doesNotMatch(
      componentSources.support,
      /Si la tienne manque, écris-moi directement\./,
    );
  });

  it("keeps support answers factual and aligned with the landing FAQ", () => {
    assert.equal(componentSources.support.match(/\n {4}question:/g)?.length, 9);

    for (const source of [componentSources.support, componentSources.faq]) {
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
    assert.doesNotMatch(
      componentSources.support,
      /chiffrement de bout en bout|Google Drive/,
    );
  });

  it("keeps support links accessible and answer copy canonical", () => {
    assert.match(
      componentSources.support,
      /const SETTINGS_URL = angularUrl\("\/settings", "faq_delete_account"\);/,
    );
    assert.match(
      componentSources.support,
      /question: "Comment supprimer mon compte et mes données\u202f\?"[\s\S]*?href=\{SETTINGS_URL\}[\s\S]*?>\s*paramètres\s*<\/a>[\s\S]*?plainAnswer:/,
    );
    assert.match(componentSources.support, /answer\?: ReactNode;/);
    assert.match(
      componentSources.support,
      /answer=\{faq\.answer \?\? faq\.plainAnswer\}/,
    );
    assert.equal(
      componentSources.support.match(/inline-flex min-h-11 items-center/g)
        ?.length,
      2,
    );
    assert.doesNotMatch(
      componentSources.support,
      /const linkClass\s*=\s*"[^"]*min-h-11/,
    );
    assert.equal(componentSources.support.match(/\n {4}answer:/g)?.length, 4);

    for (const linkedAnswer of [
      {
        question: "Pourquoi confier mes chiffres à Pulpe\u202f?",
        href: "href={GITHUB_URL}",
        facts: [
          "Tes montants ne sont jamais stockés en clair.",
          "deux clés conservées séparément",
          "code source est public",
        ],
      },
      {
        question: "Est-ce que je peux essayer sans créer de compte\u202f?",
        href: "href={DEMO_URL}",
        facts: [
          "mode démo",
          "utiliser Pulpe sans compte",
          "sans saisir tes propres",
        ],
      },
      {
        question: "C'est vraiment gratuit\u202f?",
        href: "href={GITHUB_URL}",
        facts: [
          "Pulpe est gratuit, sans publicité ni abonnement.",
          "projet solo",
          "code source est public",
        ],
      },
      {
        question: "Comment supprimer mon compte et mes données\u202f?",
        href: "href={SETTINGS_URL}",
        facts: [
          "demander la suppression",
          "paramètres",
          "programmés pour être supprimés dans trois jours",
          "supprimés des systèmes actifs",
          "sauvegardes techniques",
          "politique de rétention",
        ],
      },
    ]) {
      const start = componentSources.support.indexOf(
        `question: "${linkedAnswer.question}",`,
      );
      const end = componentSources.support.indexOf("\n  },", start);
      assert.ok(start >= 0 && end > start);

      const block = componentSources.support
        .slice(start, end)
        .replace(/\s+/g, " ");
      const plainAnswerIndex = block.indexOf("plainAnswer:");
      assert.ok(plainAnswerIndex > 0);

      const visibleAnswer = block.slice(0, plainAnswerIndex);
      const plainAnswer = block.slice(plainAnswerIndex);
      assert.ok(visibleAnswer.includes(linkedAnswer.href));
      for (const fact of linkedAnswer.facts) {
        assert.ok(visibleAnswer.includes(fact));
        assert.ok(plainAnswer.includes(fact));
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

  it("keeps desktop footer links readable and aligned with the tagline", () => {
    assert.match(
      componentSources.footer,
      /lg:flex-row lg:items-end lg:justify-between/,
    );
    assert.match(componentSources.footer, /text-sm font-semibold text-text"/);
    assert.match(
      componentSources.footer,
      /min-h-11 min-w-11 items-center[^"\n]*lg:items-end/,
    );
  });
});
