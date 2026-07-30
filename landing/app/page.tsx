import {
  Header,
  Hero,
  Solution,
  Features,
  Platforms,
  WhyFree,
  FinalCTA,
  Footer,
} from "@/components/sections";
import { LandingMotion } from "@/components/LandingMotion";

export default function LandingPage() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-[60] focus-visible:bg-primary focus-visible:text-on-primary focus-visible:px-4 focus-visible:py-2 focus-visible:rounded-lg"
      >
        Aller au contenu
      </a>

      <Header />
      <LandingMotion />

      <main id="main-content" tabIndex={-1}>
        <Hero />
        <Solution />
        <Features />
        <Platforms />
        <WhyFree />
        <FinalCTA />
      </main>

      <Footer />
    </>
  );
}
