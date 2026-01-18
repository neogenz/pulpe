import {
  AppMockup,
  Button,
  CanvasTrail,
  FadeIn,
  GridBackground,
  ShineBorder,
  TypeWriter,
} from "../ui";

const TYPEWRITER_STRINGS = [
  "Profite de ton mois.",
  "Anticipe tes dépenses.",
  "Épargne sans y penser.",
  "Reprends le contrôle.",
];

export function Hero() {
  return (
    <section className="relative pt-28 pb-0 md:pt-32 overflow-visible">
      {/* Background card with rounded bottom corners and side margins */}
      <div className="max-h-[900px] absolute inset-y-0 inset-x-3 md:inset-x-6 lg:inset-x-28 bg-background rounded-b-[2rem] md:rounded-b-[3rem] lg:rounded-b-[4rem]" />

      {/* Grid background - extends into PainPoints top padding */}
      <GridBackground className="inset-x-3 md:inset-x-6 lg:inset-x-8 bottom-[-10rem] md:bottom-[-12rem] lg:bottom-[-14rem]" />

      {/* Interactive canvas trail effect */}
      <CanvasTrail
        trails={25}
        hueOffset={140} // Green hue to match primary
        opacity={0.025}
      />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
        {/* Centered text content */}
        <FadeIn animateOnMount noYMovement>
          <div className="text-center max-w-3xl mx-auto mb-0 md:mb-2">
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
            <div className="flex flex-col gap-3 items-center">
              <ShineBorder
                color={["#006E25", "#2B883B", "#0061A6"]}
                borderWidth={2}
                duration={6}
                className="bg-transparent"
              >
                <Button>Commencer</Button>
              </ShineBorder>
              <span className="text-xs text-text-secondary italic">
                C'est gratuit
              </span>
              <a
                href="#features"
                className="text-sm text-primary font-medium hover:underline underline-offset-4"
              >
                Voir comment ça marche
              </a>
            </div>
          </div>
        </FadeIn>

        {/* Single screenshot - positioned to overlap into next section */}
        <FadeIn animateOnMount noYMovement delay={0.2}>
          <div className="max-w-4xl mx-auto -mt-2 md:-mt-4 translate-y-12 md:translate-y-16 lg:translate-y-20 max-h-[520px] overflow-hidden rounded-[var(--radius-large)] shadow-[var(--shadow-mockup-elevated)] bg-surface">
            <AppMockup
              src="/screenshots/webapp/dashboard.png"
              alt="Dashboard Pulpe"
              showBrowserChrome
              shadow="default"
              className="shadow-none"
            />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
