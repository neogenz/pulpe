import {
  Button,
  Screenshot,
  FadeIn,
  ShineBorder,
  TypeWriter,
  CanvasTrail,
} from '../ui'

const TYPEWRITER_STRINGS = [
  'Profite de ton mois.',
  'Anticipe tes dépenses.',
  'Épargne sans y penser.',
  'Reprends le contrôle.',
]

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-28 pb-16 md:pt-32 md:pb-24 bg-background overflow-hidden">
      {/* Interactive canvas trail effect */}
      <CanvasTrail
        trails={25}
        hueOffset={140} // Green hue to match primary
        opacity={0.025}
      />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <FadeIn animateOnMount noYMovement>
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">
              L'app budget simple
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-text mb-6">
              Planifie ton année.
              <br />
              {/* Static text on mobile, TypeWriter on desktop */}
              <span className="text-primary md:hidden">
                Profite de ton mois.
              </span>
              <span className="text-primary hidden md:inline">
                <TypeWriter strings={TYPEWRITER_STRINGS} />
              </span>
            </h1>
            <p className="text-lg md:text-xl text-text-secondary mb-8 max-w-lg">
              Fini le stress des dépenses oubliées. Anticipe tout et note en 2
              clics.
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <ShineBorder
                  color={['#006E25', '#2B883B', '#0061A6']}
                  borderWidth={2}
                  duration={6}
                  className="bg-transparent"
                >
                  <Button>Commencer</Button>
                </ShineBorder>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center min-h-[48px] px-6 text-primary font-semibold hover:underline underline-offset-4"
                >
                  Voir comment ça marche
                </a>
              </div>
              <span className="text-sm text-text-secondary">C'est gratuit</span>
            </div>
          </FadeIn>

          <FadeIn animateOnMount noYMovement delay={0.2} className="relative">
            <Screenshot
              src="/screenshots/webapp/dashboard.png"
              label="Dashboard Pulpe - Vue du mois en cours"
            />
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
