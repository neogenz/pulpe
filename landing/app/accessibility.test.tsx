import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
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
  imageLightbox: readFileSync(
    new URL("../components/ui/ImageLightbox.tsx", import.meta.url),
    "utf8",
  ),
  screenshot: readFileSync(
    new URL("../components/ui/Screenshot.tsx", import.meta.url),
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
  fadeIn: readFileSync(
    new URL("../components/ui/FadeIn.tsx", import.meta.url),
    "utf8",
  ),
  heroDashboard: readFileSync(
    new URL("../components/ui/HeroDashboard.tsx", import.meta.url),
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
    assert.match(sectionFields, /width:\s*40vw;/);
    assert.match(sectionFields, /height:\s*60vh;/);
    assert.match(
      sectionFields,
      /transform:\s*translateY\(-50%\) rotate\(-30deg\);/,
    );
    assert.match(sectionFields, /filter:\s*blur\(150px\);/);
    assert.match(sectionFields, /opacity:\s*0\.4;/);
    assert.match(globalsCss, /--ambient-mobile-leaf:\s*oklch\(70% 0\.2 145\);/);
    assert.match(
      globalsCss,
      /--ambient-mobile-mint:\s*oklch\(75% 0\.18 164\);/,
    );
    assert.match(
      globalsCss,
      /--ambient-mobile-lime:\s*oklch\(82% 0\.19 121\);/,
    );
    assert.match(
      globalsCss,
      /\.hero-mesh::before,[\s\S]*?\.pain-points-mesh::before\s*\{(?=[\s\S]*?left:\s*-10%;)(?=[\s\S]*?top:\s*90%;)/,
    );
    assert.match(
      globalsCss,
      /\.hero-mesh::after,[\s\S]*?\.pain-points-mesh::after\s*\{(?=[\s\S]*?right:\s*-10%;)(?=[\s\S]*?top:\s*10%;)/,
    );
    assert.match(
      globalsCss,
      /\.hero-mesh::before,[\s\S]*?background-color:\s*var\(--ambient-mobile-leaf\);/,
    );
    assert.match(
      globalsCss,
      /\.hero-mesh::after,[\s\S]*?background-color:\s*var\(--ambient-mobile-mint\);/,
    );
    assert.doesNotMatch(
      globalsCss,
      /\.pain-points-mesh::after\s*\{[^}]*background-color:\s*var\(--ambient-mobile-leaf\);/,
    );
    assert.match(componentSources.painPoints, /pain-points-mesh/);
  });

  it("keeps the hero focused on one CTA and one compact proof", () => {
    assert.match(componentSources.hero, /\bpb-12\b/);
    assert.match(componentSources.hero, /\bmd:pb-28\b/);
    assert.match(componentSources.hero, /<blockquote/);
    assert.match(componentSources.hero, /Une utilisatrice de Pulpe/);
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
    assert.match(
      componentSources.hero,
      /<mark className="marker-highlight marker-highlight-proof">[\s\S]*<strong className="font-semibold">[\s\S]*prévoir nos vacances sur l&apos;année[\s\S]*<\/strong>[\s\S]*<\/mark>[\s\S]*Ça me\s*rassure/,
    );
    assert.doesNotMatch(componentSources.hero, /dépenses que je ne voyais pas/);
    assert.doesNotMatch(componentSources.hero, /href="#how-it-works"/);
  });

  it("keeps the liquid-glass navbar readable over page content", () => {
    assert.match(
      componentSources.header,
      /bg-surface\/80 shadow-\[0_4px_30px_rgba\(0,0,0,0\.1\)\] backdrop-blur-\[14px\] backdrop-saturate-150 ring-1 ring-white\/60/,
    );
    assert.match(
      componentSources.header,
      /bg-white\/40 shadow-none backdrop-blur-none ring-1 ring-transparent/,
    );
    assert.match(
      componentSources.header,
      /transition-\[background-color,backdrop-filter,box-shadow\] duration-500/,
    );
    assert.match(
      componentSources.header,
      /href=\{link\.href\}[\s\S]*?className="[^"]*\btext-text\b[^"]*"/,
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
      /Ton mois type[\s\S]*ecran-des-modeles\.webp[\s\S]*Ton année[\s\S]*vue-calendrier-annuel\.webp/,
    );
    assert.match(componentSources.solution, /<HowItWorks \/>/);
  });

  it("gives all three planning screenshots the same desktop frame without cropping", () => {
    assert.equal(
      componentSources.howItWorks.match(/desktopAspectRatio=/g)?.length,
      3,
    );
    assert.equal(
      componentSources.howItWorks.match(/fit="contain"/g)?.length,
      3,
    );
    assert.match(componentSources.screenshot, /desktopAspectRatio\?: string;/);
    assert.match(
      componentSources.screenshot,
      /fit === "contain" \? "object-contain" : "object-cover"/,
    );
  });

  it("presents the three setup steps as one scannable ordered process", () => {
    assert.match(
      componentSources.howItWorks,
      /<ol[\s\S]*md:grid-cols-3[\s\S]*STEPS\.map/,
    );
    assert.match(
      componentSources.howItWorks,
      /<li[\s\S]*<figure[\s\S]*step\.image\.content[\s\S]*<StepCopy/,
    );
    assert.match(
      componentSources.howItWorks,
      /inline-flex size-8[\s\S]*rounded-full[\s\S]*bg-primary/,
    );
    assert.doesNotMatch(componentSources.howItWorks, /md:grid-cols-12/);
    assert.doesNotMatch(componentSources.howItWorks, /lg:space-y-20/);
  });

  it("centers each desktop step on its screenshot axis", () => {
    assert.match(
      componentSources.howItWorks,
      /<StepCopy step=\{step\} className="mt-5 md:text-center" \/>/,
    );
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

    assert.match(html, /aria-expanded="false"/);
    const panel = html.match(/<div[^>]*role="region"[^>]*>/)?.[0];
    assert.ok(panel, "Accordion panel region is missing");
    assert.match(panel, /aria-hidden="true"/);
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
  });

  it("associates the mobile menu button with its navigation panel", () => {
    assert.match(componentSources.header, /aria-controls="mobile-nav-panel"/);
    assert.match(componentSources.header, /id="mobile-nav-panel"/);
  });

  it("waits for analytics before decorating cross-domain links", () => {
    assert.match(
      componentSources.posthogProvider,
      /const initialization = initPostHog\(\);[\s\S]*if \(!initialization\) return;[\s\S]*e\.preventDefault\(\);[\s\S]*await Promise\.race\(\[[\s\S]*initialization,[\s\S]*POSTHOG_NAVIGATION_TIMEOUT_MS[\s\S]*const distinctId = getDistinctId\(\);/,
    );
    assert.match(
      componentSources.posthogProvider,
      /const POSTHOG_NAVIGATION_TIMEOUT_MS = 300;/,
    );
    assert.match(
      componentSources.posthog,
      /export function initPostHog\(\): Promise<void> \| undefined/,
    );
    assert.match(componentSources.posthog, /import type \{ PostHog \}/);
    assert.match(
      componentSources.posthog,
      /type PostHogClient = Pick<\s*PostHog,\s*"capture" \| "get_distinct_id"\s*>;/,
    );
  });

  it("uses targeted reduced-motion states", () => {
    assert.doesNotMatch(
      globalsCss,
      /(?:animation|transition)-duration:\s*0\.01ms/,
    );
    assert.match(componentSources.roadmap, /motion-safe:animate-pulse/);
    assert.match(componentSources.screenshot, /motion-reduce:transition-none/);
  });

  it("adds inset neutral outlines to product images", () => {
    assert.match(componentSources.screenshot, /outline-black\/10/);
    assert.match(componentSources.imageLightbox, /outline-white\/10/);
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

  it("dismisses the mobile navigation when the page starts scrolling", () => {
    assert.match(componentSources.header, /const closeOnScroll/);
    assert.match(
      componentSources.header,
      /addEventListener\(['"]scroll['"], closeOnScroll, \{ passive: true \}\)/,
    );
    assert.match(
      componentSources.header,
      /removeEventListener\(['"]scroll['"], closeOnScroll\)/,
    );
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

  it("pairs each of the three static setup steps with its own screenshot", () => {
    assert.match(componentSources.howItWorks, /number: "01"/);
    assert.match(componentSources.howItWorks, /number: "02"/);
    assert.match(componentSources.howItWorks, /number: "03"/);
    assert.doesNotMatch(componentSources.howItWorks, /number: "04"/);
    assert.doesNotMatch(componentSources.howItWorks, /IntersectionObserver/);
    assert.equal(componentSources.howItWorks.match(/<Screenshot/g)?.length, 3);
    assert.match(componentSources.howItWorks, /liste-des-previsions\.webp/);
    assert.equal(componentSources.howItWorks.match(/iosSrc=/g)?.length, 3);
    assert.match(componentSources.screenshot, /\/iPhone\|iPod\//);
    assert.match(componentSources.screenshot, /!isDesktop && isIPhone/);
    assert.match(componentSources.screenshot, /IOS_IMAGE_HEIGHT = 1630/);
    assert.match(componentSources.howItWorks, /id="how-it-works"/);
  });

  it("places authentic testimonials after product proof with quote semantics", () => {
    assert.match(
      componentSources.page,
      /<Solution \/>[\s\S]*<Testimonials \/>[\s\S]*<Platforms \/>/,
    );
    assert.doesNotMatch(componentSources.page, /<HowItWorks \/>/);
    assert.match(componentSources.testimonials, /<blockquote/);
    assert.match(componentSources.testimonials, /<cite/);
    assert.match(componentSources.testimonials, /Ismaël/);
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
      /\.marker-highlight\s*\{[\s\S]*?margin-inline:\s*-0\.1em;[\s\S]*?padding-inline:\s*0\.1em;[\s\S]*?border-radius:\s*0\.12em 0\.08em 0\.1em 0\.06em;[\s\S]*?176\.5deg[\s\S]*?background-size:\s*100% 0\.92em;[\s\S]*?background-position:\s*0 56%;/,
    );
    assert.match(
      globalsCss,
      /\.marker-highlight-strong\s*\{[\s\S]*?--marker-color:\s*var\(--color-marker-highlight-strong\);/,
    );
    assert.match(
      globalsCss,
      /\.marker-highlight-proof\s*\{[\s\S]*?--marker-color:\s*var\(--color-marker-highlight-proof\);[\s\S]*?color:\s*var\(--color-text\);/,
    );
    assert.equal(componentSources.testimonials.match(/highlight:/g)?.length, 3);
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
    assert.match(componentSources.ogGenerator, /children: "926"/);
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
    assert.equal(
      componentSources.features.match(/ADJUSTMENTS\.map/g)?.length,
      1,
    );
    assert.match(componentSources.features, /Cet achat peut attendre/);
    assert.match(
      componentSources.features,
      /Tes dépenses restent faciles à retrouver/,
    );
    assert.match(
      componentSources.features,
      /Chaque mois part du solde du précédent/,
    );
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
    assert.match(
      componentSources.features,
      /Août[\s\S]*420 CHF[\s\S]*Sept\.[\s\S]*420 CHF/,
    );
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

  it("separates primary and secondary planning tools for faster scanning", () => {
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
    assert.match(
      componentSources.features,
      /<section[\s\S]*aria-labelledby="adjustments-heading"/,
    );
    assert.match(componentSources.features, /Pour ajuster sans tout refaire\./);
    assert.match(
      componentSources.features,
      /<ul className="mt-8 grid gap-4 md:grid-cols-3/,
    );
    assert.match(
      componentSources.features,
      /rounded-\[var\(--radius-card\)\] bg-surface p-5 outline outline-1 -outline-offset-1 outline-black\/10/,
    );
    assert.match(
      componentSources.features,
      /<div className="flex items-start gap-3">[\s\S]*className="mt-0\.5 size-5 shrink-0 text-primary"[\s\S]*<h4 className="balance text-lg/,
    );
    assert.match(
      componentSources.features,
      /<p className="pretty mt-3 pl-8 text-sm/,
    );
    assert.doesNotMatch(
      componentSources.features,
      /aria-hidden="true"\s*\/>\s*<h4 className="balance mt-4/,
    );
    assert.doesNotMatch(
      componentSources.features,
      /mt-auto pt-8[\s\S]*rounded-\[var\(--radius-card\)\]/,
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
    assert.match(
      componentSources.footer,
      /text-sm font-semibold text-text-secondary/,
    );
    assert.match(
      componentSources.footer,
      /min-h-11 min-w-11 items-center[^"\n]*lg:items-end/,
    );
  });
});
