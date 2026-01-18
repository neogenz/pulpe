import type { ReactNode } from 'react'
import { AppMockup } from './AppMockup'
import { GradientBlob } from './GradientBlob'

interface FloatingCardConfig {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  rotation?: number
  delay?: number
  content: ReactNode
  hideOnMobile?: boolean
  hideOnTablet?: boolean
}

interface MockupCompositionProps {
  screenshot: { src: string; alt: string }
  floatingCards?: FloatingCardConfig[]
  variant?: 'hero' | 'feature'
  showBackground?: boolean
  className?: string
}

const POSITION_CLASSES: Record<FloatingCardConfig['position'], string> = {
  'top-left': 'top-0 left-0 -translate-x-1/4 -translate-y-1/4',
  'top-right': 'top-0 right-0 translate-x-1/4 -translate-y-1/4',
  'bottom-left': 'bottom-0 left-0 -translate-x-1/4 translate-y-1/4',
  'bottom-right': 'bottom-0 right-0 translate-x-1/4 translate-y-1/4',
}

export function MockupComposition({
  screenshot,
  floatingCards = [],
  variant = 'hero',
  showBackground = true,
  className = '',
}: MockupCompositionProps) {
  const isHero = variant === 'hero'

  return (
    <div className={`relative ${className}`}>
      {showBackground && (
        <>
          <GradientBlob
            size="lg"
            className="-top-20 -right-20 hidden lg:block"
          />
          <GradientBlob
            size="md"
            className="-bottom-16 -left-16 hidden lg:block"
          />
        </>
      )}

      <AppMockup
        src={screenshot.src}
        alt={screenshot.alt}
        showBrowserChrome={isHero}
        shadow={isHero ? 'elevated' : 'default'}
        className="relative z-10"
      />

      {/* Floating cards - hidden on mobile, partial on tablet, full on desktop */}
      {floatingCards.map((card, index) => {
        const hideOnMobile = card.hideOnMobile !== false
        const hideOnTablet = card.hideOnTablet ?? false

        let responsiveClass = ''
        if (hideOnMobile && hideOnTablet) {
          responsiveClass = 'hidden lg:flex'
        } else if (hideOnMobile) {
          responsiveClass = 'hidden md:flex'
        }

        return (
          <div
            key={index}
            className={`
              absolute z-20 bg-surface rounded-[var(--radius-card)]
              shadow-[var(--shadow-floating)] px-4 py-3 flex items-center gap-3
              animate-float-bob
              ${POSITION_CLASSES[card.position]}
              ${responsiveClass}
            `}
            style={{
              transform: `${POSITION_CLASSES[card.position].includes('translate') ? '' : ''}rotate(${card.rotation || 0}deg)`,
              animationDelay: `${card.delay || 0}s`,
            }}
          >
            {card.content}
          </div>
        )
      })}
    </div>
  )
}
