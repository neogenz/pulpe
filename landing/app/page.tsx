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

export default function LandingPage() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-[60] focus-visible:bg-primary focus-visible:text-white focus-visible:px-4 focus-visible:py-2 focus-visible:rounded-lg"
      >
        Aller au contenu
      </a>

      <Header />

      {/* pb reserves the StickyCTA's own height so the bar never lands on the
          last readable line; dropped at lg, where the bar does not render. */}
      <main
        id="main-content"
        tabIndex={-1}
        className="pb-[calc(3.75rem+max(0.75rem,env(safe-area-inset-bottom)))] lg:pb-0"
      >
        <Hero />
        <PainPoints />
        <Solution />
        <Testimonials />
        <Features />
        <Platforms />
        <WhyFree />
        <FAQ />
        <FinalCTA />
      </main>

      <Footer />
      <MarkerDraw />
      <StickyCTA />
    </>
  );
}
