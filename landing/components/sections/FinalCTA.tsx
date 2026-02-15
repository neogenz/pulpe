import { Button, Container, FadeIn, GrainOverlay } from '@/components/ui'
import { ANGULAR_APP_URL } from '@/lib/config'

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
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
              Prêt à voir clair dans tes finances ?
            </h2>
            <p className="text-lg text-white/80 mb-10 max-w-xl mx-auto">
              Gratuit, open source, et respectueux de ta vie privée.
            </p>
            <Button href={`${ANGULAR_APP_URL}/signup`} variant="inverse">
              Commencer gratuitement
            </Button>
          </FadeIn>
        </div>
      </Container>
    </section>
  )
}
