import { memo } from 'react'
import { cn } from '@/lib/cn'

interface GrainOverlayProps {
  opacity?: number
  className?: string
}

export const GrainOverlay = memo(function GrainOverlay({
  opacity = 0.04,
  className,
}: GrainOverlayProps) {
  return (
    <div
      className={cn('grain absolute inset-0 pointer-events-none', className)}
      aria-hidden="true"
      style={{ opacity }}
    />
  )
})
