import Link from 'next/link'
import { ArrowRight, Check, Hammer, PackageCheck, Telescope } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Card, FadeIn, Section } from '@/components/ui'

type RoadmapStatus = 'shipped' | 'inProgress' | 'next'

interface RoadmapItem {
  title: string
  description: string
}

interface RoadmapColumn {
  status: RoadmapStatus
  icon: LucideIcon
  label: string
  items: RoadmapItem[]
}

const ROADMAP_COLUMNS: RoadmapColumn[] = [
  {
    status: 'shipped',
    icon: PackageCheck,
    label: 'Livré récemment',
    items: [
      {
        title: 'Lissage de dépense',
        description:
          'Répartis une grosse dépense — impôts, vacances — sur plusieurs mois, avec le montant à prévoir chaque mois.',
      },
      {
        title: 'Report de dépense',
        description:
          'Décale une dépense prévue au mois suivant, sans la supprimer ni la recréer.',
      },
      {
        title: "Objectifs d'épargne",
        description:
          'Crée tes objectifs et rattache ton épargne prévue pour savoir où elle va.',
      },
    ],
  },
  {
    status: 'inProgress',
    icon: Hammer,
    label: 'En cours',
    items: [
      {
        title: 'Épargne guidée',
        description:
          "Suivi de progression et ajustement automatique de l'épargne vers ton objectif.",
      },
      {
        title: 'Tags de dépenses',
        description:
          'Étiquette tes dépenses pour les retrouver et les regrouper facilement.',
      },
    ],
  },
  {
    status: 'next',
    icon: Telescope,
    label: 'À venir',
    items: [
      {
        title: 'App Android',
        description: "La même expérience que sur iPhone, native sur Android.",
      },
      {
        title: 'Pointage optionnel',
        description:
          'Pointer chaque dépense deviendra un choix, pas une obligation.',
      },
    ],
  },
]

const COLUMN_CARD_BORDER_COLORS: Record<
  RoadmapStatus,
  CSSProperties['borderColor']
> = {
  shipped: undefined,
  inProgress: 'rgb(0 110 37 / 0.3)',
  next: 'rgb(26 28 25 / 0.1)',
}

function ItemMarker({ status }: { status: RoadmapStatus }) {
  if (status === 'shipped') {
    return (
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 shrink-0 mt-0.5">
        <Check className="w-3 h-3 text-primary" strokeWidth={2.5} />
      </span>
    )
  }
  if (status === 'inProgress') {
    return (
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 shrink-0 mt-0.5">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
      </span>
    )
  }
  return (
    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-text/5 shrink-0 mt-0.5">
      <span className="w-2 h-2 rounded-full bg-text/25" />
    </span>
  )
}

export function Roadmap() {
  return (
    <Section id="roadmap">
      <FadeIn variant="blur">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-primary text-center mb-4">
          Roadmap
        </p>
        <h2 className="text-3xl md:text-5xl font-bold text-center mb-4 tracking-[-0.02em] balance">
          Pulpe avance,{' '}
          <span className="italic font-normal text-primary">
            mois après mois.
          </span>
        </h2>
        <p className="text-text-secondary text-center mb-14 max-w-xl mx-auto pretty">
          Ce qui vient d&apos;être livré, ce qui se construit, ce qui arrive
          ensuite. Sans date promise — le cap compte plus que le calendrier.
        </p>
      </FadeIn>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {ROADMAP_COLUMNS.map((column, index) => (
          <FadeIn key={column.status} variant="blur" delay={index * 0.1}>
            <Card
              variant="organic"
              className="h-full p-6 lg:p-7"
              style={{ borderColor: COLUMN_CARD_BORDER_COLORS[column.status] }}
            >
              <div className="flex items-center gap-3 mb-5">
                <span
                  className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${
                    column.status === 'next' ? 'bg-text/5' : 'bg-primary/10'
                  }`}
                >
                  <column.icon
                    className={`w-5 h-5 ${
                      column.status === 'next'
                        ? 'text-text-secondary'
                        : 'text-primary'
                    }`}
                    strokeWidth={1.5}
                  />
                </span>
                <h3 className="font-semibold text-lg">{column.label}</h3>
              </div>

              <ul className="space-y-5">
                {column.items.map((item) => (
                  <li key={item.title} className="flex gap-3">
                    <ItemMarker status={column.status} />
                    <div>
                      <p className="font-semibold text-sm text-text mb-0.5">
                        {item.title}
                      </p>
                      <p className="text-text-secondary text-sm leading-relaxed pretty">
                        {item.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </FadeIn>
        ))}
      </div>

      <FadeIn variant="blur" delay={0.4}>
        <div className="text-center mt-12">
          <Link
            href="/changelog"
            className="inline-flex items-center gap-1.5 text-accent font-medium transition-transform duration-200 [transition-timing-function:var(--ease-spring)] hover:-translate-y-0.5 py-3 px-2"
          >
            Tout le détail dans les nouveautés
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </FadeIn>
    </Section>
  )
}
