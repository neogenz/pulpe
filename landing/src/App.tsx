import { ImageLightboxProvider } from './components/ImageLightboxProvider'
import {
  Header,
  Footer,
  Hero,
  PainPoints,
  Solution,
  Features,
  HowItWorks,
  Platforms,
  WhyFree,
  FinalCTA,
} from './components/sections'

function App() {
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

export default App
