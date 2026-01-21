'use client'

import { memo, useCallback, useSyncExternalStore } from 'react'
import { useImageLightbox } from '@/contexts/useImageLightbox'

interface ScreenshotProps {
  src?: string
  desktopSrc?: string
  label: string
  className?: string
  /** Set to true for LCP image to disable lazy loading */
  isLCP?: boolean
  /** Fetch priority hint for the browser */
  fetchPriority?: 'high' | 'low' | 'auto'
}

const DESKTOP_MEDIA_QUERY = '(min-width: 768px)'

function toWebP(path: string): string {
  return path.replace(/\.png$/, '.webp')
}

function subscribeToMediaQuery(callback: () => void) {
  const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY)
  mediaQuery.addEventListener('change', callback)
  return () => mediaQuery.removeEventListener('change', callback)
}

function getIsDesktop() {
  return typeof window !== 'undefined'
    ? window.matchMedia(DESKTOP_MEDIA_QUERY).matches
    : false
}

function getServerSnapshot() {
  return false
}

export const Screenshot = memo(function Screenshot({
  src,
  desktopSrc,
  label,
  className = '',
  isLCP = false,
  fetchPriority,
}: ScreenshotProps) {
  const { openLightbox } = useImageLightbox()
  const isDesktop = useSyncExternalStore(
    subscribeToMediaQuery,
    getIsDesktop,
    getServerSnapshot
  )

  const handleClick = useCallback(() => {
    if (!src) return
    const imageSrc = isDesktop && desktopSrc ? toWebP(desktopSrc) : toWebP(src)
    openLightbox(imageSrc, label)
  }, [src, desktopSrc, label, isDesktop, openLightbox])

  if (src) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="block w-full cursor-pointer transition-transform duration-200 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-xl md:rounded-[var(--radius-large)]"
        aria-label={`Agrandir : ${label}`}
      >
        <picture>
          {/* WebP sources (modern browsers) */}
          {desktopSrc && (
            <source
              media="(min-width: 768px)"
              srcSet={toWebP(desktopSrc)}
              type="image/webp"
            />
          )}
          <source srcSet={toWebP(src)} type="image/webp" />
          {/* PNG fallback (older browsers) */}
          {desktopSrc && (
            <source media="(min-width: 768px)" srcSet={desktopSrc} />
          )}
          <img
            src={src}
            alt={label}
            loading={isLCP ? 'eager' : 'lazy'}
            fetchPriority={fetchPriority}
            className={`rounded-xl md:rounded-[var(--radius-large)] shadow-[var(--shadow-screenshot)] w-full ${className}`}
          />
        </picture>
      </button>
    )
  }

  return (
    <div
      className={`bg-surface-alt rounded-xl md:rounded-[var(--radius-large)] shadow-[var(--shadow-screenshot)] flex items-center justify-center text-text-secondary text-sm font-medium ${className}`}
      role="img"
      aria-label={label}
    >
      [Screenshot: {label}]
    </div>
  )
})
