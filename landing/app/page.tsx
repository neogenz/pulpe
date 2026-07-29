import { ImageLightboxProvider } from "@/contexts/ImageLightboxProvider";
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
    <ImageLightboxProvider>
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-[60] focus-visible:bg-primary focus-visible:text-white focus-visible:px-4 focus-visible:py-2 focus-visible:rounded-lg"
      >
        Aller au contenu
      </a>

      <Header />

      <main id="main-content" tabIndex={-1}>
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
    </ImageLightboxProvider>
  );
}
