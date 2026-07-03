import { memo } from 'react'

interface LimeWedgeProps {
  className?: string
}

const SEGMENTS = 8
const SEGMENT_LINES = Array.from({ length: SEGMENTS }, (_, i) => {
  const angle = Math.PI / SEGMENTS + (i * (2 * Math.PI)) / SEGMENTS
  return {
    x: 100 + Math.cos(angle) * 74,
    y: 100 + Math.sin(angle) * 74,
  }
})

/**
 * Abstract citrus-slice mark — the Pulpe "lime" motif made explicit.
 * Purely decorative brand texture: inherits currentColor and is meant to sit
 * large and low-opacity behind content. Control tint/visibility on the caller.
 */
export const LimeWedge = memo(function LimeWedge({ className }: LimeWedgeProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="100" cy="100" r="96" stroke="currentColor" strokeWidth="3.5" />
      <circle cx="100" cy="100" r="76" stroke="currentColor" strokeWidth="1.5" />
      {SEGMENT_LINES.map((p, i) => (
        <line
          key={i}
          x1="100"
          y1="100"
          x2={p.x}
          y2={p.y}
          stroke="currentColor"
          strokeWidth="1.5"
        />
      ))}
      <circle cx="100" cy="100" r="8" fill="currentColor" />
    </svg>
  )
})
