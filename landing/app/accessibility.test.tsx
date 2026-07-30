import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { PostHog } from "posthog-js/dist/module.slim";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccordionItem } from "../components/ui/AccordionItem";

Object.assign(globalThis, { React });

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function declarations(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\{([^}]*)\\}`));
  assert.ok(match, `Missing CSS rule: ${selector}`);
  return match[1];
}

function assertOrdered(haystack: string, tokens: readonly string[]): void {
  let previous = -1;
  for (const token of tokens) {
    const current = haystack.indexOf(token);
    assert.ok(current > previous, `${token} is missing or out of order`);
    previous = current;
  }
}

const globalsCss = source("./globals.css");
const sources = {
  page: source("./page.tsx"),
  layout: source("./layout.tsx"),
  button: source("../components/ui/Button.tsx"),
  phoneMockup: source("../components/ui/PhoneMockup.tsx"),
  accordion: source("../components/ui/AccordionItem.tsx"),
  header: source("../components/sections/Header.tsx"),
  hero: source("../components/sections/Hero.tsx"),
  solution: source("../components/sections/Solution.tsx"),
  features: source("../components/sections/Features.tsx"),
  platforms: source("../components/sections/Platforms.tsx"),
  whyFree: source("../components/sections/WhyFree.tsx"),
  finalCta: source("../components/sections/FinalCTA.tsx"),
  footer: source("../components/sections/Footer.tsx"),
  support: source("./support/page.tsx"),
  changelog: source("./changelog/page.tsx"),
  config: source("../lib/config.ts"),
  posthog: source("../lib/posthog.ts"),
  posthogProvider: source("../components/PostHogProvider.tsx"),
  landingMotion: source("../components/LandingMotion.tsx"),
};

const marketingSources = [
  sources.hero,
  sources.solution,
  sources.features,
  sources.platforms,
  sources.whyFree,
  sources.finalCta,
];

describe("landing contracts", () => {
  it("uses the target native font stack and display metrics", () => {
    assert.match(
      globalsCss,
      /--font-sans:\s*-apple-system,\s*BlinkMacSystemFont,\s*"SF Pro Display",\s*"SF Pro Text",\s*"Helvetica Neue",\s*Arial,\s*sans-serif;/,
    );
    assert.doesNotMatch(globalsCss, /@font-face|Poppins/i);
    assert.doesNotMatch(sources.layout, /next\/font/);
    assert.match(
      globalsCss,
      /--text-hero:\s*clamp\(4\.15rem,\s*8\.5vw,\s*7\.6rem\)/,
    );
    assert.match(
      globalsCss,
      /--text-section:\s*clamp\(2\.85rem,\s*6\.4vw,\s*5\.6rem\)/,
    );
    const displayRule = declarations(
      globalsCss,
      "#main-content h1,#main-content h2",
    );
    assert.match(displayRule, /font-weight:\s*760/);
    assert.match(displayRule, /letter-spacing:\s*-\.06em/);
  });

  it("keeps the hero j and i from colliding", () => {
    assert.match(
      sources.hero,
      /className="hero-title-last block">visible\.<\/span>/,
    );
    assert.match(
      declarations(globalsCss, ".hero-title-last"),
      /margin-top:\s*\.04em/,
    );
  });

  it("lets the hero atmosphere blend into the next section", () => {
    assert.doesNotMatch(sources.hero, /overflow-hidden/);
    assert.match(
      declarations(globalsCss, ".hero"),
      /var\(--color-background\)\s*100%/,
    );
  });

  it("keeps the new home in its intended reading order", () => {
    assertOrdered(sources.page, [
      "<Hero />",
      "<Solution />",
      "<Features />",
      "<Platforms />",
      "<WhyFree />",
      "<FinalCTA />",
    ]);
    assert.match(sources.page, /href="#main-content"/);
    assert.match(sources.page, /<main id="main-content" tabIndex=\{-1\}>/);
    assert.doesNotMatch(
      sources.page,
      /PainPoints|HowItWorks|Testimonials|FAQ|StickyCTA|ImageLightbox/,
    );
    assert.doesNotMatch(sources.layout, /lightbox-root/);
  });

  it("keeps skip links keyboard-only and moves focus to main content", () => {
    for (const route of [sources.page, sources.support]) {
      const skipLinkClass = route.match(
        /href="#main-content"\s+className="([^"]+)"/,
      )?.[1];

      assert.ok(skipLinkClass, "Skip link classes are missing");
      assert.match(skipLinkClass, /focus-visible:not-sr-only/);
      assert.doesNotMatch(skipLinkClass, /(?:^|\s)focus:/);
      assert.match(route, /<main id="main-content" tabIndex=\{-1\}>/);
      assert.ok(route.indexOf('href="#main-content"') < route.indexOf("<Header"));
    }
  });

  it("places copy before every product proof on mobile", () => {
    const featureArticles =
      sources.features.match(/<article[\s\S]*?<\/article>/g) ?? [];
    assert.equal(featureArticles.length, 2);
    for (const article of featureArticles) {
      assert.ok(article.indexOf("<h3") < article.indexOf("<PhoneMockup"));
    }
    assert.ok(
      sources.solution.indexOf("<h3") <
        sources.solution.indexOf('aria-hidden="true"'),
    );
    assert.ok(
      sources.platforms.indexOf("<h2") <
        sources.platforms.indexOf("<PhoneMockup"),
    );
  });

  it("uses one shared iPhone frame with intrinsic image dimensions", () => {
    assert.match(sources.phoneMockup, /aspect-\[750\/1630\]/);
    assert.match(sources.phoneMockup, /width=\{750\}/);
    assert.match(sources.phoneMockup, /height=\{1630\}/);
    assert.match(
      sources.phoneMockup,
      /sizes="\(min-width: 941px\) 390px, \(min-width: 621px\) 350px, 78vw"/,
    );
    assert.match(sources.phoneMockup, /priority=\{priority\}/);
    assert.match(
      sources.phoneMockup,
      /fetchPriority=\{priority \? "high" : "auto"\}/,
    );

    const phoneUsages = [
      sources.hero,
      sources.features,
      sources.platforms,
    ].join("\n");
    assert.equal(phoneUsages.match(/<PhoneMockup/g)?.length, 4);
    assert.equal(phoneUsages.match(/\n\s+priority(?:\s|\/>)/g)?.length, 1);
    assert.match(sources.hero, /Vue annuelle des budgets dans Pulpe sur iPhone/);
    assert.match(sources.features, /Écran des modèles de budget dans Pulpe/);
    assert.match(sources.features, /Détail d’un budget mensuel dans Pulpe/);
    assert.match(sources.platforms, /Tableau de bord Pulpe en mode sombre/);
    assert.doesNotMatch(sources.features, /\bpriority\b/);
    assert.doesNotMatch(sources.platforms, /<PhoneMockup[\s\S]*?\bpriority\b/);
  });

  it("keeps marketing content visible without JavaScript", () => {
    for (const section of marketingSources) {
      assert.doesNotMatch(
        section,
        /IntersectionObserver|fade-in-view|js-scroll-hidden|animate-fade-in/,
      );
    }
    assert.doesNotMatch(marketingSources.join("\n"), /data-reveal="pending"/);
    assert.match(sources.landingMotion, /IntersectionObserver/);
    assert.match(sources.landingMotion, /threshold:\s*0\.12/);
    assert.match(
      globalsCss,
      /\[data-reveal=(?:"pending"|pending)\]\s*\{[^}]*opacity:\s*0/,
    );
    assert.doesNotMatch(sources.header, /use client|useState|<details|<summary/);
  });

  it("preserves focus geometry and 44px interaction targets", () => {
    for (const selector of [":focus-visible", ".focus-on-dark:focus-visible"]) {
      const rule = declarations(globalsCss, selector);
      assert.match(rule, /outline:\s*2px solid/);
      assert.doesNotMatch(rule, /border-radius/);
    }
    assert.match(sources.button, /min-h-\[44px\]/);
    assert.match(sources.header, /min-h-11/);
    assert.match(sources.platforms, /inline-flex min-h-11/);
    assert.match(sources.footer, /inline-flex min-h-11/);
  });

  it("uses targeted reduced-motion fallbacks", () => {
    assert.match(
      globalsCss,
      /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*scroll-behavior:\s*auto/,
    );
    for (const component of [
      sources.button,
      sources.header,
      sources.platforms,
      sources.footer,
    ]) {
      assert.match(component, /motion-reduce:/);
      assert.doesNotMatch(component, /transition-all/);
    }
    assert.doesNotMatch(
      globalsCss,
      /(?:animation|transition)-duration:\s*0\.01ms/,
    );
  });

  it("keeps the floating header responsive and script-free", () => {
    assert.match(sources.header, /<header className="site-header sticky/);
    assert.match(
      sources.header,
      /min-\[721px\]:grid-cols-\[1fr_auto_1fr\]/,
    );
    assert.match(sources.header, /hidden items-center gap-1 min-\[721px\]:flex/);
    assert.match(sources.header, /transition-\[background-color,color,scale\]/);
    assert.match(
      declarations(globalsCss, ".site-header-inner"),
      /padding:\s*0 16px/,
    );
    assert.doesNotMatch(
      sources.layout,
      /MOBILE_NAV|toggleAttribute\('data-scrolled'|IntersectionObserver/,
    );
  });

  it("keeps the header CTA concentric with the navbar edge", () => {
    assert.match(
      declarations(globalsCss, ".site-status"),
      /margin-right:\s*-9px/,
    );
    assert.match(
      globalsCss,
      /@media \(width<=720px\)\{[\s\S]*?\.site-status\{margin-right:-6px\}/,
    );
  });

  it("keeps lower-page link hovers from repainting the sticky header", () => {
    const headerRule = declarations(globalsCss, ".site-header-inner");
    assert.doesNotMatch(headerRule, /backdrop-filter/);
    assert.match(headerRule, /background:\s*#[\da-f]{8}/i);
  });

  it("keeps menu hover pills centered inside their 44px targets", () => {
    assert.doesNotMatch(sources.header, /hover:bg-/);
    const navLinkRule = declarations(globalsCss, ".site-primary-nav a");
    assert.match(navLinkRule, /position:\s*relative/);
    assert.match(navLinkRule, /isolation:\s*isolate/);
    const navPillRule = declarations(
      globalsCss,
      ".site-primary-nav a:before",
    );
    assert.match(navPillRule, /inset:\s*4px(?:;|$)/);
    assert.match(navPillRule, /border-radius:\s*999px/);
    assert.doesNotMatch(
      globalsCss,
      /\.site-primary-nav a:hover(?:,[^{]+)?\{[^}]*transform/,
    );
    assert.match(
      declarations(globalsCss, ".site-primary-nav a:hover:before"),
      /background:\s*#ffffffc2/,
    );
    const darkTheme = globalsCss.slice(
      globalsCss.indexOf("@media (prefers-color-scheme:dark)"),
    );
    assert.match(
      darkTheme,
      /\.site-primary-nav a:hover:before\{[^}]*background:#ffffff14/,
    );
  });

  it("keeps Pulpe green on actions and removes decorative scan motion", () => {
    assert.match(
      declarations(globalsCss, ".hero-primary-status"),
      /background:\s*var\(--color-primary\)/,
    );
    assert.match(
      declarations(globalsCss, ".hero-secondary-link"),
      /color:\s*var\(--color-primary\)/,
    );
    assert.match(
      declarations(globalsCss, ".site-status"),
      /background:\s*var\(--color-primary\)/,
    );
    const navRule = declarations(globalsCss, ".site-primary-nav");
    assert.match(navRule, /align-items:\s*center/);
    assert.doesNotMatch(navRule, /display:\s*flex/);
    assert.match(sources.header, /src="\/app-icon\.webp"/);
    assert.match(sources.hero, /src="\/app-icon\.webp"/);
    assert.doesNotMatch(sources.features, /scan-line/);
    assert.doesNotMatch(globalsCss, /scan-line|scan-receipt|status-pulse/);
  });

  it("keeps safe-area coverage on the page and header", () => {
    assert.match(
      sources.layout,
      /media:\s*"\(prefers-color-scheme: light\)"[\s\S]*color:\s*"#eaf6e6"[\s\S]*media:\s*"\(prefers-color-scheme: dark\)"[\s\S]*color:\s*"#141210"[\s\S]*viewportFit:\s*"cover"/,
    );
    assert.match(
      sources.header,
      /pl-\[max\(0\.75rem,env\(safe-area-inset-left\)\)\]/,
    );
    assert.match(
      sources.header,
      /pt-\[max\(0\.75rem,env\(safe-area-inset-top\)\)\]/,
    );
    assert.match(sources.hero, /env\(safe-area-inset-top\)/);
    assert.match(
      globalsCss,
      /padding-inline:\s*env\(safe-area-inset-left\)\s*env\(safe-area-inset-right\)/,
    );
  });

  it("tracks every conversion action through one delegated listener", () => {
    assert.match(
      sources.posthogProvider,
      /closest<HTMLElement>\(\s*"\[data-cta-name\]"/,
    );
    assert.match(sources.posthogProvider, /trackCTAClick\(/);
    assert.match(sources.posthog, /CTA_TRACKING_TIMEOUT_MS = 300/);
    assert.match(
      sources.posthog,
      /posthogClient\?\.capture\(\s*"cta_clicked"/,
    );
    for (const section of [
      sources.header,
      sources.hero,
      sources.platforms,
      sources.finalCta,
    ]) {
      assert.match(section, /data-cta-name=/);
      assert.doesNotMatch(section, /trackCTAClick/);
    }
  });

  it("keeps landing analytics isolated from authenticated app identity", () => {
    assert.doesNotMatch(sources.posthogProvider, /getDistinctId|ph_did/);
    assert.doesNotMatch(
      sources.posthog,
      /get_distinct_id|cross_subdomain_cookie:\s*true/,
    );
    assert.match(
      sources.posthog,
      /persistence_name:\s*POSTHOG_PERSISTENCE_NAME/,
    );
    assert.match(sources.posthog, /cross_subdomain_cookie:\s*false/);
    assert.match(sources.posthog, /Domain=\.pulpe\.app/);
    assert.match(sources.posthogProvider, /e\.preventDefault\(\)/);
    assert.match(sources.posthogProvider, /e\.button === 0/);
    assert.match(sources.posthogProvider, /!e\.metaKey/);
    assert.match(sources.posthogProvider, /!e\.ctrlKey/);
    assert.match(sources.posthogProvider, /!anchor\.download/);
    assert.match(
      sources.posthogProvider,
      /\(!anchor\.target \|\| anchor\.target === "_self"\)/,
    );
    assert.match(sources.posthogProvider, /window\.location\.assign\(href\)/);
  });

  it("bounds CTA tracking when analytics initialization is slow", async () => {
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
        location: { hostname: "pulpe.app" },
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
          assert.equal(cookies.has("ph_test-landing-key_posthog"), false);
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
      const startedAt = performance.now();
      await slow.trackCTAClick("commencer", "hero", "/signup");
      assert.ok(performance.now() - startedAt < 1_000);
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

  it("keeps signup, demo and platform destinations explicit", () => {
    assert.match(
      sources.hero,
      /angularUrl\("\/signup", "hero_commencer"\)/,
    );
    assert.match(
      sources.finalCta,
      /angularUrl\("\/signup", "final_cta_commencer"\)/,
    );
    assert.match(
      sources.finalCta,
      /angularUrl\("\/welcome", "final_cta_demo"\)/,
    );
    assert.match(
      sources.platforms,
      /angularUrl\("\/welcome", "platforms_ouvrir"\)/,
    );
    assert.match(sources.platforms, /apps\.apple\.com\/app\/pulpe/);
  });

  it("keeps the four guarantees factual and rejects forbidden claims", () => {
    assert.equal(sources.whyFree.match(/title:/g)?.length, 4);
    assert.match(sources.whyFree, /AES-256-GCM/);
    assert.match(sources.whyFree, /Aucune banque connectée/);
    assert.match(sources.whyFree, /Code source public/);
    assert.match(sources.whyFree, /JSON ou en Excel/);

    const homeCopy = marketingSources.join("\n");
    assert.doesNotMatch(
      homeCopy,
      /no tracking|sans tracking|zero[- ]knowledge|zéro connaissance|héberg(?:é|ement)[^\n]*(?:suisse|europ)/i,
    );
  });

  it("follows the system dark appearance across the landing", () => {
    assert.match(sources.platforms, /<article className="platforms-dark/);
    assert.match(globalsCss, /@media \(prefers-color-scheme:dark\)\{/);
    assert.match(
      globalsCss,
      /@media \(prefers-color-scheme:dark\)\{[\s\S]*color-scheme:dark/,
    );
    assert.match(
      globalsCss,
      /@media \(prefers-color-scheme:dark\)\{[\s\S]*--color-background:#141210/,
    );
    assert.match(
      globalsCss,
      /@media \(prefers-color-scheme:dark\)\{[\s\S]*--color-on-primary:#0a1f0d/,
    );
    assert.match(
      globalsCss,
      /@media \(prefers-color-scheme:dark\)\{[\s\S]*\.site-header-inner\{/,
    );
    assert.match(
      globalsCss,
      /@media \(prefers-color-scheme:dark\)\{[\s\S]*\.product-panel--model\{/,
    );
    assert.match(
      globalsCss,
      /@media \(prefers-color-scheme:dark\)\{[\s\S]*\.privacy-section,\s*\.site-footer\{/,
    );
    assert.match(
      declarations(globalsCss, "body"),
      /background-color:\s*var\(--color-background\)/,
    );
    assert.match(sources.button, /bg-primary text-on-primary/);
    assert.match(sources.button, /bg-white text-primary-strong/);
    assert.match(sources.page, /focus-visible:text-on-primary/);
    assert.match(sources.solution, /bg-primary[^"]*text-on-primary/);
    assert.match(
      declarations(globalsCss, ".site-status"),
      /color:\s*var\(--color-on-primary\)/,
    );
    assert.doesNotMatch(
      [sources.solution, sources.features].join("\n"),
      /#9a4d00|#b35800/i,
    );
    assert.doesNotMatch(globalsCss, /html\[data-(?:theme|mode)=["']dark/);
  });

  it("retains every footer destination in accessible columns", () => {
    for (const destination of [
      "/#features",
      "/#platforms",
      "/changelog",
      "/support",
      "/legal/cgu",
      "/legal/confidentialite",
    ]) {
      assert.match(sources.footer, new RegExp(destination.replace("/", "\\/")));
    }
    assert.match(sources.footer, /href: GITHUB_URL/);
    assert.match(sources.footer, /href: `mailto:\$\{CONTACT_EMAIL\}`/);
    assert.match(
      sources.config,
      /GITHUB_URL = 'https:\/\/github\.com\/neogenz\/pulpe'/,
    );
    assert.match(sources.config, /CONTACT_EMAIL = 'maxime\.desogus@gmail\.com'/);
    assert.match(sources.footer, /aria-label=\{group\.label\}/);
    assert.match(
      sources.footer,
      /min-\[720px\]:grid-cols-\[1\.4fr_0\.8fr_0\.8fr\]/,
    );
  });

  it("keeps the shared header, footer and canonical on secondary routes", () => {
    for (const [route, canonical] of [
      [sources.support, "/support"],
      [sources.changelog, "/changelog"],
    ] as const) {
      assertOrdered(route, ["<Header />", "<main", "<Footer />"]);
      assert.match(route, new RegExp(`canonical:\\s*['"]${canonical}['"]`));
    }
  });

  it("preserves the audited support page contracts", () => {
    assert.match(sources.support, /hero-mesh/);
    assert.match(sources.support, /max-w-3xl/);
    assert.match(sources.support, /<AccordionItem/);
    assert.match(sources.support, /<FinalCTA \/>/);
    assert.doesNotMatch(sources.support, /<details|<summary/);
    assert.match(
      sources.accordion,
      /focus:outline-none[^"]*focus-visible:ring-2[^"]*focus-visible:ring-inset[^"]*focus-visible:ring-primary/,
    );

    const questions = [
      ...sources.support.matchAll(/question: "([^"]+)"/g),
    ].map((match) => match[1]);
    assert.equal(questions.length, 9);
    assert.ok(questions.every((question) => question.endsWith("\u202f?")));
    assert.match(sources.support, /Si la tienne manque, écris-moi\./);

    for (const fact of [
      "prestataires externes",
      "contraintes réglementaires",
      "coût est trop élevé",
      "saisie reste manuelle",
      "deux clés conservées séparément",
      "dérivée de ton code PIN",
      "fuite de la base seule",
      "AES-256-GCM",
      "déchiffrés côté serveur",
      "ne sont ni transmis à des fins publicitaires ni revendus",
    ]) {
      assert.match(sources.support, new RegExp(fact));
    }
    assert.match(sources.support, /mainEntity: faqs\.map/);
    assert.match(sources.support, /text: faq\.plainAnswer/);
    assert.match(
      sources.support,
      /const SETTINGS_URL = angularUrl\("\/settings", "faq_delete_account"\)/,
    );
    assert.equal(
      sources.support.match(/inline-flex min-h-11 items-center/g)?.length,
      2,
    );
  });

  it("uses the intended responsive boundaries", () => {
    for (const width of [620, 720, 940]) {
      assert.match(
        globalsCss,
        new RegExp(`@media \\((?:max-width:\\s*${width}px|width<=${width}px)\\)`),
      );
    }
    assert.match(sources.hero, /min-\[621px\]/);
    assert.match(sources.hero, /min-\[941px\]:grid-cols/);
    assert.match(sources.header, /min-\[721px\]/);
    assert.match(sources.whyFree, /min-\[620px\]:grid-cols-2/);
    assert.match(sources.whyFree, /min-\[941px\]:grid-cols-4/);
    assert.match(
      declarations(globalsCss, ".hero-inner"),
      /width:\s*calc\(100%\s*-\s*2\*var\(--page-gutter\)\)/,
    );
    const tabletCss = globalsCss.slice(
      globalsCss.indexOf("@media (width<=940px)"),
      globalsCss.indexOf("@media (width<=720px)"),
    );
    const tabletHeroInner = declarations(tabletCss, ".hero-inner");
    assert.match(tabletHeroInner, /width:\s*100%/);
    assert.match(
      tabletHeroInner,
      /padding-inline:\s*var\(--page-gutter\)/,
    );
  });

  it("keeps collapsed support answers accessible without client state", () => {
    const html = renderToStaticMarkup(
      <AccordionItem question="Question" answer="Réponse" />,
    );
    assert.match(html, /^<details/);
    assert.match(html, /<summary/);
    assert.doesNotMatch(html, /<details open/);
    assert.match(html, /\binvisible\b/);
    assert.match(html, /group-open:visible/);
    assert.doesNotMatch(sources.accordion, /use client|useState/);
  });
});
