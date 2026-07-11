'use client'

import Image from 'next/image'
import { memo, useEffect, useId, useState } from 'react'
import { Check } from 'lucide-react'
import { CountUp } from './CountUp'

interface HeroDashboardProps {
  /** Available amount shown in the green panel (counts up). */
  amount: number
  /** Currency unit label (CHF / €). */
  unit: string
}

const PREVISIONS = [
  { label: 'Loyer', amount: '1 200', state: 'checked' as const },
  { label: 'Assurance', amount: '25', state: 'ticks' as const },
  { label: 'Électricité', amount: '85', state: 'unchecked' as const },
]

/** Upward-trending balance projection — the signature "courbe de solde". */
const CURVE = 'M0,27 C14,25 22,29 34,25 C46,21 54,16 66,17 C78,18 86,9 100,8'

/**
 * Live HTML recreation of the Pulpe dashboard's value zone, replacing the static
 * screenshot. On mount: the "disponible" amount counts up, the spent bar fills,
 * one prévision ticks itself, and the balance curve draws in. Everything snaps to
 * its final state under prefers-reduced-motion.
 */
export const HeroDashboard = memo(function HeroDashboard({
  amount,
  unit,
}: HeroDashboardProps) {
  const gradientId = useId()
  const [monthLabel, setMonthLabel] = useState('')
  const [live, setLive] = useState(false)
  const [ticked, setTicked] = useState(false)

  useEffect(() => {
    setMonthLabel(
      new Intl.DateTimeFormat('fr-CH', { month: 'long' }).format(new Date())
    )

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setLive(true)
      setTicked(true)
      return
    }
    const raf = requestAnimationFrame(() => setLive(true))
    const timer = setTimeout(() => setTicked(true), 1500)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [])

  return (
    <div className="animate-fade-in-scale">
      <div className="rounded-[var(--radius-large)] bg-surface border border-text/5 shadow-[var(--shadow-screenshot)] overflow-hidden">
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-text/[0.06]">
          <Image
            src="/icon-64.webp"
            alt=""
            aria-hidden={true}
            width={20}
            height={20}
            className="h-5 w-auto"
          />
          <span className="text-sm font-semibold text-text">Tableau de bord</span>
          <span
            className="ml-auto w-6 h-6 rounded-full bg-primary/10"
            aria-hidden="true"
          />
        </div>

        <div className="p-4 space-y-4">
          {/* Green hero panel */}
          <div className="rounded-2xl p-5 bg-gradient-to-br from-primary to-[#004d1a] text-white">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-white/70 font-semibold mb-3">
              <span
                className="w-1.5 h-1.5 rounded-full bg-white/80"
                aria-hidden="true"
              />
              Mois en cours{monthLabel ? ` · ${monthLabel}` : ''}
            </div>
            <div className="text-xs text-white/70 mb-1">Disponible ce mois</div>
            <div className="mb-4 leading-none">
              <CountUp
                value={amount}
                delayMs={300}
                format={(n) => `${n}`}
                ariaLabel={`${amount} ${unit}`}
                className="text-[3rem] font-extrabold tabular-nums tracking-[-0.02em]"
              />
              <span
                aria-hidden="true"
                className="text-lg font-semibold text-white/80 ml-1"
              >
                {unit}
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-white/70 mb-1.5 tabular-nums">
              <span>Dépensé 3 374 {unit}</span>
              <span>sur 4 300 {unit}</span>
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-white/90 motion-safe:transition-[width] motion-safe:duration-[1400ms] motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ width: live ? '78%' : '0%' }}
              />
            </div>
          </div>

          {/* Prévisions — one ticks itself */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-text-secondary font-semibold mb-2">
              Prévisions du mois
            </div>
            <ul className="space-y-2">
              {PREVISIONS.map((p) => {
                const isChecked =
                  p.state === 'checked' || (p.state === 'ticks' && ticked)
                return (
                  <li key={p.label} className="flex items-center gap-3 text-sm">
                    <span
                      className={`grid place-items-center w-[18px] h-[18px] rounded-[5px] border transition-colors duration-300 ${
                        isChecked
                          ? 'bg-primary border-primary'
                          : 'border-text/25 bg-transparent'
                      }`}
                      aria-hidden="true"
                    >
                      {isChecked && (
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      )}
                    </span>
                    <span
                      className={`flex-1 ${
                        isChecked ? 'text-text-secondary' : 'text-text'
                      }`}
                    >
                      {p.label}
                    </span>
                    <span className="tabular-nums text-text-secondary">
                      {p.amount} {unit}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Signature: projection du solde curve */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-text-secondary font-semibold mb-2">
              Projection du solde
            </div>
            <svg
              viewBox="0 0 100 36"
              className="w-full h-16"
              preserveAspectRatio="none"
              role="img"
              aria-label="Projection du solde en hausse sur l'année"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-primary)"
                    stopOpacity="0.18"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-primary)"
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>
              <path
                d={`${CURVE} L100,36 L0,36 Z`}
                fill={`url(#${gradientId})`}
                className="hero-spark-area"
              />
              <path
                d={CURVE}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                className="hero-spark-line"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
})
