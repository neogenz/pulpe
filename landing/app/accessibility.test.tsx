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
});
