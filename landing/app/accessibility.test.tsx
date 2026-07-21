import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
  layout: readFileSync(new URL("./layout.tsx", import.meta.url), "utf8"),
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
    assert.match(componentSources.hero, /Ismaël/);
    assert.doesNotMatch(componentSources.hero, /href="#how-it-works"/);
  });

  it("frames the problem and current alternatives before the solution", () => {
    assert.match(
      componentSources.painPoints,
      /LIMITS = \[[\s\S]*Le tableur te demande[\s\S]*Le suivi arrive après la dépense/,
    );
    assert.doesNotMatch(componentSources.painPoints, /PROOFS = \[/);
    assert.match(componentSources.page, /<PainPoints \/>[\s\S]*<Solution \/>/);
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
    assert.match(
      componentSources.testimonials,
      /className="mt-6 grid border-t border-text\/10/,
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

  it("presents the product setup as exactly three static steps", () => {
    assert.match(componentSources.howItWorks, /number: "01"/);
    assert.match(componentSources.howItWorks, /number: "02"/);
    assert.match(componentSources.howItWorks, /number: "03"/);
    assert.doesNotMatch(componentSources.howItWorks, /number: "04"/);
    assert.doesNotMatch(componentSources.howItWorks, /IntersectionObserver/);
    assert.doesNotMatch(componentSources.howItWorks, /Screenshot/);
  });

  it("places authentic testimonials after product proof with quote semantics", () => {
    assert.match(
      componentSources.page,
      /<Solution \/>[\s\S]*<HowItWorks \/>[\s\S]*<Testimonials \/>[\s\S]*<Platforms \/>/,
    );
    assert.match(componentSources.testimonials, /<blockquote/);
    assert.match(componentSources.testimonials, /<cite/);
    assert.match(componentSources.testimonials, /Ismaël/);
    assert.doesNotMatch(componentSources.testimonials, /carousel|autoPlay/);
    assert.doesNotMatch(componentSources.testimonials, /background="primary"/);
  });

  it("keeps the roadmap out of the conversion funnel", () => {
    assert.doesNotMatch(componentSources.page, /<Roadmap \/>/);
    assert.doesNotMatch(componentSources.page, /<Features \/>/);
  });

  it("keeps final conversion copy factual and aligned with metadata", () => {
    assert.doesNotMatch(componentSources.finalCta, /Julie|blockquote/);
    assert.match(componentSources.whyFree, /AES-256-GCM/);
    assert.match(
      componentSources.layout,
      /des mois d’avance ce qu’il te restera/i,
    );
    assert.match(
      componentSources.finalCta,
      /mois d&apos;avance sur ce qu&apos;il te restera/i,
    );
  });

  it("keeps final CTA supporting copy legible over the ambient field", () => {
    assert.match(componentSources.finalCta, /max-w-2xl[^"\n]*text-text\/80/);
    assert.doesNotMatch(
      componentSources.finalCta,
      /max-w-2xl[^"\n]*text-text-secondary/,
    );
  });
});
