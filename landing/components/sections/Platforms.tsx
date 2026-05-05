'use client'

import { Globe, Smartphone } from 'lucide-react'
import { Section, Badge, Button, FadeIn, Card, ShineBorder } from '@/components/ui'
import { angularUrl } from '@/lib/config'
import { trackCTAClick } from '@/lib/posthog'

const IOS_APP_URL = 'https://apps.apple.com/ch/app/pulpe/id6758464920'

/** Apple brand mark — official silhouette (same glyph as the App Store badge) */
function AppleLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01ZM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
    </svg>
  )
}

export function Platforms() {
  return (
    <Section id="platforms">
      <FadeIn variant="blur">
        <h2 className="text-3xl md:text-5xl font-bold text-center mb-4 tracking-[-0.02em] balance">
          Disponible{' '}
          <span className="italic font-normal text-primary">
            partout.
          </span>
        </h2>
        <p className="text-center text-text-secondary text-lg mb-14 max-w-xl mx-auto pretty">
          Navigateur, iPhone, bientôt Android. Tes données te suivent.
        </p>
      </FadeIn>

      {/* Asymmetric 2+1 layout: iOS is the hero (full-width on lg, left column wide),
          with Web + Android stacked on the right. Breaks the 3-equal-towers pattern. */}
      <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
        {/* iOS App — hero card, spans 3/5 columns.
            ShineBorder radius (22) = Card radius (20) + 2px border-width, so the
            animated stroke hugs the card edge exactly instead of leaving a visible
            inner-card silhouette. Card stretched via w-full h-full. */}
        <FadeIn variant="blur" delay={0.1} className="lg:col-span-3">
          <ShineBorder borderRadius={22} duration={10} className="h-full w-full">
            <Card
              variant="organic"
              className="w-full h-full flex flex-col p-8 lg:p-12 relative overflow-hidden rounded-[20px]"
            >
              <div
                aria-hidden="true"
                className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary/8 blur-3xl"
              />
              <div className="relative flex flex-col h-full">
                <div className="flex items-start justify-between mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <AppleLogo className="w-8 h-8 text-primary" />
                  </div>
                  <Badge>Nouveau</Badge>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold mb-3 tracking-[-0.01em]">
                  App iOS native
                </h3>
                <p className="text-text-secondary text-base md:text-lg leading-relaxed mb-8 max-w-md pretty">
                  Notifications, widgets, Face ID. Pensée pour iPhone, pas
                  portée à la va-vite.
                </p>
                <div className="mt-auto">
                  <a
                    href={IOS_APP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block transition-transform duration-200 hover:scale-[1.03] [transition-timing-function:var(--ease-spring)]"
                    aria-label="Télécharger sur l'App Store"
                  >
                    <img
                      src="/app-store-badge.svg"
                      alt="Télécharger sur l'App Store"
                      width={135}
                      height={45}
                      loading="lazy"
                      className="h-[52px] w-auto"
                    />
                  </a>
                </div>
              </div>
            </Card>
          </ShineBorder>
        </FadeIn>

        {/* Right column: Web + Android stacked */}
        <div className="lg:col-span-2 grid grid-cols-1 gap-6 lg:gap-8">
          {/* Web App */}
          <FadeIn variant="blur" delay={0.2}>
            <Card
              variant="elevated"
              className="h-full flex flex-col p-6 lg:p-7"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Web App</h3>
              </div>
              <p className="text-text-secondary text-sm mb-5 flex-1 leading-relaxed">
                Ouvre Pulpe dans ton navigateur. Rien à installer.
              </p>
              <Button
                href={angularUrl('/welcome', 'platforms_ouvrir')}
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() =>
                  trackCTAClick('ouvrir_navigateur', 'platforms', '/welcome')
                }
              >
                Ouvrir dans le navigateur
              </Button>
            </Card>
          </FadeIn>

          {/* Android — downweighted */}
          <FadeIn variant="blur" delay={0.3}>
            <Card
              variant="elevated"
              className="h-full flex flex-col p-6 lg:p-7 opacity-70"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-text/5 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5 text-text-secondary" />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">Android</h3>
                  <Badge>Bientôt</Badge>
                </div>
              </div>
              <p className="text-text-secondary text-sm flex-1 leading-relaxed">
                En cours. En attendant, la web app tourne nickel sur mobile.
              </p>
            </Card>
          </FadeIn>
        </div>
      </div>
    </Section>
  )
}
