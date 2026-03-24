'use client'

import { Button, Container, FadeIn, GrainOverlay } from '@/components/ui'
import { angularUrl } from '@/lib/config'
import { trackCTAClick } from '@/lib/posthog'

export function FinalCTA() {
  return (
    <section className="py-20 md:py-28 bg-gradient-to-br from-primary to-[#004d1a] relative overflow-hidden">
      <GrainOverlay opacity={0.06} />

      {/* Decorative organic blobs */}
      <div
        className="absolute top-[-10%] right-[-5%] w-72 h-72 bg-white/5 organic-blob"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-15%] left-[-8%] w-96 h-96 bg-white/5 organic-blob"
        aria-hidden="true"
      />

      <Container>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <FadeIn variant="blur">
            <blockquote className="text-lg md:text-xl italic text-white/90 mb-8">
              &laquo;&nbsp;Je sais pas comment je faisais avant Pulpe, c&apos;est tellement plus simple. Je suis tellement moins stressée par mes sous.&nbsp;&raquo;
              <footer className="mt-2 text-sm text-white/60 not-italic">— Julie</footer>
            </blockquote>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
              3 minutes pour savoir ce qu&apos;il te reste.
            </h2>
            <p className="text-lg text-white/80 mb-10 max-w-xl mx-auto">
              Gratuit, données privées, montants protégés. Essaie — si ça te plaît pas, tu retournes à Excel.
            </p>
            <Button href={angularUrl('/signup', 'final_cta_commencer')} variant="inverse" onClick={() => trackCTAClick('commencer_gratuitement', 'final_cta', '/signup')}>
              Commencer gratuitement
            </Button>
          </FadeIn>
        </div>
      </Container>
    </section>
  )
}
