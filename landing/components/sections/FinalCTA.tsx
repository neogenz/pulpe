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
            <blockquote className="italic text-xl md:text-2xl lg:text-3xl text-white/95 mb-10 leading-snug max-w-2xl mx-auto balance">
              &laquo;&nbsp;Je sais pas comment je faisais avant Pulpe, c&apos;est
              tellement plus simple. Je suis tellement moins stressée par mes
              sous.&nbsp;&raquo;
              <footer className="mt-3 text-sm text-white/60 not-italic font-sans tracking-[0.08em] uppercase">
                — Julie
              </footer>
            </blockquote>
            <h2 className="text-3xl md:text-4xl lg:text-[3.25rem] font-bold text-white mb-5 leading-[1.05] tracking-[-0.02em] balance">
              3 minutes pour savoir{' '}
              <span className="italic font-normal text-white/90">
                ce qu&apos;il te reste.
              </span>
            </h2>
            <p className="text-lg text-white/80 mb-10 max-w-xl mx-auto pretty">
              Gratuit, données privées, montants protégés. Essaie — si ça te
              plaît pas, tu retournes à Excel.
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
