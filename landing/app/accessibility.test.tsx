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
  card: readFileSync(
    new URL("../components/ui/Card.tsx", import.meta.url),
    "utf8",
  ),
  header: readFileSync(
    new URL("../components/sections/Header.tsx", import.meta.url),
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
  roadmap: readFileSync(
    new URL("../components/sections/Roadmap.tsx", import.meta.url),
    "utf8",
  ),
  howItWorks: readFileSync(
    new URL("../components/sections/HowItWorks.tsx", import.meta.url),
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
    assert.doesNotMatch(componentSources.header, /active:scale-(?:95|\[0\.98\])/);
    assert.match(componentSources.button, /active:scale-\[0\.96\]/);
    assert.match(componentSources.header, /min-h-10/);
  });

  it("cross-fades both mobile menu icons without unmounting either icon", () => {
    assert.doesNotMatch(componentSources.header, /mobileMenuOpen \? <X/);
    assert.match(componentSources.header, /scale-\[0\.25\] opacity-0 blur-\[4px\]/);
    assert.match(
      componentSources.header,
      /transition-\[opacity,filter,scale\]/,
    );
  });

  it("uses targeted reduced-motion states", () => {
    assert.doesNotMatch(globalsCss, /(?:animation|transition)-duration:\s*0\.01ms/);
    assert.match(componentSources.roadmap, /motion-safe:animate-pulse/);
    assert.match(componentSources.howItWorks, /motion-reduce:transition-none/);
  });

  it("adds inset neutral outlines to product images", () => {
    assert.match(
      componentSources.screenshot,
      /outline-black\/10/,
    );
    assert.match(
      componentSources.imageLightbox,
      /outline-white\/10/,
    );
  });

  it("keeps the mobile navigation non-modal and the page scrollable", () => {
    assert.doesNotMatch(componentSources.header, /lockBodyScroll/);
    assert.doesNotMatch(componentSources.header, /aria-modal/);
    assert.doesNotMatch(componentSources.header, /e\.key === ['"]Tab['"]/);
  });

  it("does not force pointer focus when the mobile navigation toggles", () => {
    assert.doesNotMatch(componentSources.header, /focusables\[0\]\?\.focus/);
    assert.doesNotMatch(componentSources.header, /else if \(wasOpen\.current\)/);
  });
});
