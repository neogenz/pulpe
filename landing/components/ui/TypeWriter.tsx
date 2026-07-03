'use client'

import { memo, useEffect, useState } from 'react'

interface TypeWriterProps {
  strings: string[]
  /** Time each phrase stays on screen before rotating, in ms. */
  interval?: number
  className?: string
}

/**
 * Rotates through `strings`, one at a time, with a masked fade + slide-up on
 * entry (no typing, no blinking cursor). The incoming phrase is remounted via
 * `key` so the entry animation replays each rotation. Reduced-motion users get
 * a plain swap. The caller reserves height so there is no layout shift.
 */
export const TypeWriter = memo(function TypeWriter({
  strings,
  interval = 2800,
  className,
}: TypeWriterProps) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (strings.length < 2) return
    const id = setInterval(() => {
      setIndex((current) => (current + 1) % strings.length)
    }, interval)
    return () => clearInterval(id)
  }, [strings, interval])

  return (
    <span className={className}>
      <span key={index} className="animate-rotate-in inline-block">
        {strings[index] ?? ''}
      </span>
    </span>
  )
})
