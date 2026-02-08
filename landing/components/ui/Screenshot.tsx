'use client'

import { memo, useCallback, useSyncExternalStore } from 'react'
import { Maximize2 } from 'lucide-react'
import { useImageLightbox } from '@/contexts/useImageLightbox'

interface ScreenshotProps {
  src?: string
  desktopSrc?: string
  label: string
  className?: string
  isLCP?: boolean
  fetchPriority?: 'high' | 'low' | 'auto'
  width?: number
  height?: number
}

const DESKTOP_MEDIA_QUERY = '(min-width: 768px)'
const MOBILE_IMAGE_WIDTH = 750
const TABLET_IMAGE_WIDTH = 1548

function toWebP(path: string): string {
  return path.replace(/\.png$/, '.webp')
}

function toMobileWebP(path: string): string {
  return path.replace('/responsive/', '/mobile/').replace(/\.png$/, '.webp')
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
  width = TABLET_IMAGE_WIDTH,
  height = 2456,
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
    const mobileWebP = toMobileWebP(src)
    const tabletWebP = toWebP(src)
    const mobileSrcSet = `${mobileWebP} ${MOBILE_IMAGE_WIDTH}w, ${tabletWebP} ${TABLET_IMAGE_WIDTH}w`

    return (
      <button
        type="button"
        onClick={handleClick}
        className="group relative block w-full cursor-pointer transition-transform duration-200 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-xl md:rounded-[var(--radius-large)]"
        aria-label={`Agrandir : ${label}`}
      >
        <picture>
          {desktopSrc && (
            <source
              media="(min-width: 768px)"
              srcSet={toWebP(desktopSrc)}
              type="image/webp"
            />
          )}
          <source
            srcSet={mobileSrcSet}
            sizes="(max-width: 767px) 100vw, 50vw"
            type="image/webp"
          />
          {desktopSrc && (
            <source media="(min-width: 768px)" srcSet={desktopSrc} />
          )}
          <img
            src={mobileWebP}
            alt={label}
            width={MOBILE_IMAGE_WIDTH}
            height={Math.round((height / width) * MOBILE_IMAGE_WIDTH)}
            loading={isLCP ? 'eager' : 'lazy'}
            fetchPriority={fetchPriority}
            className={`rounded-xl md:rounded-[var(--radius-large)] shadow-[var(--shadow-screenshot)] w-full ${className}`}
          />
        </picture>
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl md:rounded-[var(--radius-large)]">
          <span className="bg-black/50 backdrop-blur-sm rounded-full p-3">
            <Maximize2 className="w-5 h-5 text-white" />
          </span>
        </span>
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
