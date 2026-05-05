'use client'

import { Section, Button, FadeIn } from '@/components/ui'
import { angularUrl } from '@/lib/config'
import { trackCTAClick } from '@/lib/posthog'
import { Check } from 'lucide-react'

const STEPS = [
  { number: '1', title: 'Tes revenus', description: 'Ce qui rentre chaque mois' },
  { number: '2', title: 'Frais fixes', description: 'Loyer, abonnements, assurances' },
  { number: '3', title: 'Frais variables', description: 'Vacances, impôts, anniversaires' },
  { number: 'done', title: 'Tu sais ce qu\'il te reste', description: 'Chaque mois, chaque dépense — tout est là.' },
]

export function HowItWorks() {
  return (
    <Section background="grain" id="how-it-works">
      <FadeIn variant="blur">
        <h2 className="text-3xl md:text-5xl font-bold text-center mb-4 tracking-[-0.02em] balance">
          Prêt en{' '}
          <span className="italic font-normal text-primary">
            3 minutes.
          </span>
        </h2>
        <p className="text-text-secondary text-center mb-14 max-w-md mx-auto">
          Pas de configuration complexe. Juste l&apos;essentiel.
        </p>
      </FadeIn>

      {/* Desktop: horizontal progression with connector line between steps.
          Replaces 4 identical circles floating in space. */}
      <div className="hidden md:block mb-14 relative">
        {/* Connector line — sits behind the circles, stops before the final check */}
        <div
          aria-hidden="true"
          className="absolute top-7 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-primary/30 via-primary/20 to-primary/40"
        />
        <div className="grid md:grid-cols-4 gap-8 relative">
          {STEPS.map((step, index) => {
            const isDone = step.number === 'done'
            return (
              <FadeIn key={step.title} variant="blur" delay={index * 0.1}>
                <div className="text-center">
                  <div
                    className={`relative w-14 h-14 rounded-full font-bold text-xl flex items-center justify-center mx-auto mb-5 shadow-[var(--shadow-organic)] ${
                      isDone
                        ? 'bg-primary text-white ring-4 ring-primary/15'
                        : 'bg-surface text-primary border border-primary/20'
                    }`}
                  >
                    {isDone ? (
                      <Check className="w-6 h-6" strokeWidth={2.5} />
                    ) : (
                      <span className="tabular-nums">{step.number}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-lg mb-1.5 balance">
                    {step.title}
                  </h3>
                  <p className="text-text-secondary text-sm leading-relaxed pretty">
                    {step.description}
                  </p>
                </div>
              </FadeIn>
            )
          })}
        </div>
      </div>

      {/* Mobile: vertical timeline */}
      <div className="md:hidden mb-12">
        <div className="relative pl-16">
          <div className="space-y-8">
            {STEPS.map((step, index) => {
              const isDone = step.number === 'done'
              const isLast = index === STEPS.length - 1
              return (
                <FadeIn key={step.title} variant="blur" delay={index * 0.1} className="relative">
                  <div className="absolute -left-16 top-0 bottom-0">
                    <div
                      className={`w-12 h-12 rounded-full font-bold text-xl flex items-center justify-center shrink-0 relative z-10 ${
                        isDone ? 'bg-white text-primary shadow-organic' : 'bg-primary text-white'
                      }`}
                    >
                      {isDone ? <Check className="w-5 h-5" /> : step.number}
                    </div>
                    {!isLast && (
                      <div
                        className="absolute left-[23px] top-12 bottom-[-2.5rem] border-l-2 border-dashed border-primary/20"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="pt-1">
                    <h3 className="font-semibold text-lg mb-1">{step.title}</h3>
                    <p className="text-text-secondary text-sm">{step.description}</p>
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </div>
      </div>

      <FadeIn variant="blur" delay={0.4}>
        <div className="text-center">
          <Button href={angularUrl('/signup', 'how_it_works_creer')} onClick={() => trackCTAClick('creer_mon_budget', 'how_it_works', '/signup')}>Créer mon budget</Button>
        </div>
      </FadeIn>
    </Section>
  )
}
