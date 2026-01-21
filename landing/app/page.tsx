import dynamic from 'next/dynamic'
import { ImageLightboxProvider } from '@/contexts/ImageLightboxProvider'
import { Header, Hero } from '@/components/sections'

const PainPoints = dynamic(() =>
  import('@/components/sections').then((mod) => mod.PainPoints)
)
const Solution = dynamic(() =>
  import('@/components/sections').then((mod) => mod.Solution)
)
const Features = dynamic(() =>
  import('@/components/sections').then((mod) => mod.Features)
)
const HowItWorks = dynamic(() =>
  import('@/components/sections').then((mod) => mod.HowItWorks)
)
const Platforms = dynamic(() =>
  import('@/components/sections').then((mod) => mod.Platforms)
)
const WhyFree = dynamic(() =>
  import('@/components/sections').then((mod) => mod.WhyFree)
)
const FinalCTA = dynamic(() =>
  import('@/components/sections').then((mod) => mod.FinalCTA)
)
const Footer = dynamic(() =>
  import('@/components/sections').then((mod) => mod.Footer)
)

export default function LandingPage() {
  return (
    <ImageLightboxProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
      >
        Aller au contenu
      </a>

      <Header />

      <main id="main-content">
        <Hero />
        <PainPoints />
        <Solution />
        <Features />
        <HowItWorks />
        <Platforms />
        <WhyFree />
        <FinalCTA />
      </main>

      <Footer />
    </ImageLightboxProvider>
  )
}
