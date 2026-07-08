'use client'

import { memo, useEffect, useState } from 'react'

interface CountUpProps {
  /** Final value to animate to. */
  value: number
  /** Animation duration in ms. */
  durationMs?: number
  /** Formats the current (rounded) value into the displayed string. */
  format?: (n: number) => string
  className?: string
}

/**
 * Counts up from 0 to `value` once on mount using requestAnimationFrame.
 * Honours prefers-reduced-motion by jumping straight to the final value.
 * tabular-nums on the caller keeps the width stable while digits change.
 */
export const CountUp = memo(function CountUp({
  value,
  durationMs = 1100,
  format,
  className,
}: CountUpProps) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    if (prefersReduced) {
      setDisplay(value)
      return
    }

    let raf = 0
    let start = 0
    const step = (timestamp: number) => {
      if (!start) start = timestamp
      const progress = Math.min((timestamp - start) / durationMs, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(value * eased))
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, durationMs])

  return <span className={className}>{format ? format(display) : display}</span>
})
