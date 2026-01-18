import { Check, Wallet } from 'lucide-react'
import {
  Button,
  FadeIn,
  ShineBorder,
  TypeWriter,
  CanvasTrail,
  MockupComposition,
  NotificationCard,
  StatCard,
  MiniChartCard,
} from '../ui'

const TYPEWRITER_STRINGS = [
  'Profite de ton mois.',
  'Anticipe tes dépenses.',
  'Épargne sans y penser.',
  'Reprends le contrôle.',
]

export function Hero() {
  return (
    <section className="relative pt-24 pb-0 md:pt-28">
      {/* Background card with rounded bottom corners and side margins */}
      <div className="absolute inset-y-0 inset-x-3 md:inset-x-6 lg:inset-x-8 bg-background rounded-b-[2rem] md:rounded-b-[3rem] lg:rounded-b-[4rem]" />

      {/* Interactive canvas trail effect */}
      <CanvasTrail
        trails={25}
        hueOffset={140} // Green hue to match primary
        opacity={0.025}
      />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
        {/* Centered text content */}
        <FadeIn animateOnMount noYMovement>
          <div className="text-center max-w-3xl mx-auto mb-8 md:mb-10">
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
            <p className="text-lg md:text-xl text-text-secondary mb-6 max-w-xl mx-auto">
              Fini le stress des dépenses oubliées. Anticipe tout et note en 2
              clics.
            </p>
            <div className="flex flex-col gap-2 items-center">
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
          </div>
        </FadeIn>

        {/* Mockup positioned to bleed into next section */}
        <FadeIn animateOnMount noYMovement delay={0.2}>
          <div className="relative translate-y-12 md:translate-y-16 lg:translate-y-20 max-w-3xl mx-auto">
            <MockupComposition
              screenshot={{
                src: '/screenshots/webapp/dashboard.png',
                alt: 'Dashboard Pulpe - Vue du mois en cours',
              }}
              variant="hero"
              floatingCards={[
                {
                  position: 'top-right',
                  rotation: 2,
                  delay: 0.5,
                  content: (
                    <NotificationCard
                      icon={<Check size={14} />}
                      text="Budget mis à jour"
                    />
                  ),
                },
                {
                  position: 'bottom-left',
                  rotation: -3,
                  delay: 1,
                  content: (
                    <StatCard
                      icon={<Wallet size={16} />}
                      label="Disponible"
                      value="847 CHF"
                    />
                  ),
                },
                {
                  position: 'bottom-right',
                  rotation: 2,
                  delay: 1.5,
                  hideOnTablet: true,
                  content: <MiniChartCard label="Épargne" />,
                },
              ]}
            />
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
