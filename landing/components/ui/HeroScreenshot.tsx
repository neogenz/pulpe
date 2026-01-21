'use client'

import { memo } from 'react'
import { Screenshot } from './Screenshot'

interface HeroScreenshotProps {
  screenshotSrc?: string
  screenshotDesktopSrc?: string
  screenshotLabel: string
}

export const HeroScreenshot = memo(function HeroScreenshot({
  screenshotSrc,
  screenshotDesktopSrc,
  screenshotLabel,
}: HeroScreenshotProps) {
  return (
    <div className="animate-fade-in-scale">
      <Screenshot
        src={screenshotSrc}
        desktopSrc={screenshotDesktopSrc}
        label={screenshotLabel}
        isLCP
        fetchPriority="high"
      />
    </div>
  )
})
