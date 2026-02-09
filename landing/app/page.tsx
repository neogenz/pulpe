import dynamic from 'next/dynamic'
import { ImageLightboxProvider } from '@/contexts/ImageLightboxProvider'
import { Header, Hero } from '@/components/sections'

const PainPoints = dynamic(
  () => import('@/components/sections').then((mod) => mod.PainPoints),
  { loading: () => <div className="min-h-[200px]" /> }
)
const Solution = dynamic(
  () => import('@/components/sections').then((mod) => mod.Solution),
  { loading: () => <div className="min-h-[200px]" /> }
)
const Features = dynamic(
  () => import('@/components/sections').then((mod) => mod.Features),
  { loading: () => <div className="min-h-[200px]" /> }
)
const HowItWorks = dynamic(
  () => import('@/components/sections').then((mod) => mod.HowItWorks),
  { loading: () => <div className="min-h-[200px]" /> }
)
const Platforms = dynamic(
  () => import('@/components/sections').then((mod) => mod.Platforms),
  { loading: () => <div className="min-h-[200px]" /> }
)
const WhyFree = dynamic(
  () => import('@/components/sections').then((mod) => mod.WhyFree),
  { loading: () => <div className="min-h-[200px]" /> }
)
const FinalCTA = dynamic(
  () => import('@/components/sections').then((mod) => mod.FinalCTA),
  { loading: () => <div className="min-h-[200px]" /> }
)
const Footer = dynamic(
  () => import('@/components/sections').then((mod) => mod.Footer),
  { loading: () => <div className="min-h-[200px]" /> }
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
