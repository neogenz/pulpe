import { MarkerDraw, StickyCTA } from "@/components/ui";
import {
  Header,
  Hero,
  PainPoints,
  Solution,
  Testimonials,
  Features,
  Platforms,
  WhyFree,
  FAQ,
  FinalCTA,
  Footer,
} from "@/components/sections";
import type { Dictionary } from "@/content/dictionary";
import type { Locale } from "@/lib/i18n";

export function Home({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const home = dict.home;

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-[60] focus-visible:bg-primary focus-visible:text-white focus-visible:px-4 focus-visible:py-2 focus-visible:rounded-lg"
      >
        {dict.common.skipToContent}
      </a>

      <Header dict={dict.header} locale={locale} />

      {/* pb reserves the StickyCTA's own height so the bar never lands on the
          last readable line; dropped at lg, where the bar does not render.
          3.75rem is that height measured, not chosen: the Button's base
          min-h-[48px] plus the 6px of p-1.5 the StickyCTA wraps it in, top and
          bottom. Change either and this reserve is the thing that goes stale. */}
      <main
        id="main-content"
        tabIndex={-1}
        className="pb-[calc(3.75rem+max(0.75rem,env(safe-area-inset-bottom)))] lg:pb-0"
      >
        <Hero dict={home.hero} dashboardDict={home.dashboard} locale={locale} />
        <PainPoints dict={home.painPoints} />
        <Solution dict={home.solution} howItWorksDict={home.howItWorks} />
        <Testimonials dict={home.testimonials} />
        <Features dict={home.features} />
        <Platforms dict={home.platforms} locale={locale} />
        <WhyFree dict={home.whyFree} />
        <FAQ dict={home.faq} />
        <FinalCTA dict={home.finalCta} locale={locale} />
      </main>

      <Footer
        dict={dict.footer}
        language={dict.language}
        locale={locale}
        route="/"
      />
      <MarkerDraw />
      <StickyCTA label={home.stickyCta} locale={locale} />
    </>
  );
}
