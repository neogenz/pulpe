type ShadowVariant = 'default' | 'elevated' | 'floating'

interface AppMockupProps {
  src: string
  alt: string
  showBrowserChrome?: boolean
  perspective?: boolean
  perspectiveDirection?: 'left' | 'right'
  shadow?: ShadowVariant
  className?: string
}

const SHADOW_CLASSES: Record<ShadowVariant, string> = {
  default: 'shadow-[var(--shadow-mockup)]',
  elevated: 'shadow-[var(--shadow-mockup-elevated)]',
  floating: 'shadow-[var(--shadow-floating)]',
}

function BrowserChrome() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3 bg-surface border-b border-black/5">
      <span className="w-3 h-3 rounded-full bg-[#006E25]" />
      <span className="w-3 h-3 rounded-full bg-[#2B883B]" />
      <span className="w-3 h-3 rounded-full bg-[#48A353]" />
    </div>
  )
}

export function AppMockup({
  src,
  alt,
  showBrowserChrome = false,
  perspective = false,
  perspectiveDirection = 'right',
  shadow = 'default',
  className = '',
}: AppMockupProps) {
  const perspectiveStyles = perspective
    ? perspectiveDirection === 'right'
      ? 'transform rotate-y-3 rotate-x-2'
      : 'transform -rotate-y-3 rotate-x-2'
    : ''

  const wrapperStyles = `
    bg-surface rounded-[var(--radius-large)] overflow-hidden
    ${SHADOW_CLASSES[shadow]}
    ${perspectiveStyles}
    ${className}
  `

  return (
    <div
      className={wrapperStyles}
      style={perspective ? { perspective: '1000px' } : undefined}
    >
      {showBrowserChrome && <BrowserChrome />}
      <img src={src} alt={alt} className="w-full block" />
    </div>
  )
}
