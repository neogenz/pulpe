'use client'

import { memo, useEffect, useState } from 'react'

interface CountUpProps {
  /** Final value to animate to. */
  value: number
  /** Animation duration in ms. */
  durationMs?: number
  /** Delay before starting the animation in ms. Ignored for reduced motion. */
  delayMs?: number
  /** Formats the current (rounded) value into the displayed string. */
  format?: (n: number) => string
  /** Stable text for assistive tech when the visual number animates. */
  ariaLabel?: string
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
  delayMs = 0,
  format,
  ariaLabel,
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
    let timeout: ReturnType<typeof setTimeout> | undefined
    const step = (timestamp: number) => {
      if (!start) start = timestamp
      const progress = Math.min((timestamp - start) / durationMs, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(value * eased))
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    const startCount = () => {
      raf = requestAnimationFrame(step)
    }

    setDisplay(0)
    if (delayMs > 0) {
      timeout = setTimeout(startCount, delayMs)
    } else {
      startCount()
    }

    return () => {
      if (timeout) clearTimeout(timeout)
      cancelAnimationFrame(raf)
    }
  }, [value, durationMs, delayMs])

  const content = format ? format(display) : display
  if (!ariaLabel) return <span className={className}>{content}</span>

  return (
    <span className={className}>
      <span className="sr-only">{ariaLabel}</span>
      <span aria-hidden="true">{content}</span>
    </span>
  )
})
