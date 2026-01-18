import { useImageLightbox } from '../../hooks/useImageLightbox'

interface ScreenshotProps {
  src?: string
  desktopSrc?: string
  label: string
  className?: string
}

export function Screenshot({ src, desktopSrc, label, className = '' }: ScreenshotProps) {
  const { openLightbox } = useImageLightbox()

  const handleClick = () => {
    if (!src) return
    const isDesktop = window.matchMedia('(min-width: 768px)').matches
    const imageSrc = isDesktop && desktopSrc ? desktopSrc : src
    openLightbox(imageSrc, label)
  }

  if (src) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="block w-full cursor-pointer transition-transform duration-200 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-xl md:rounded-[var(--radius-large)]"
        aria-label={`Agrandir : ${label}`}
      >
        <picture>
          {desktopSrc && (
            <source media="(min-width: 768px)" srcSet={desktopSrc} />
          )}
          <img
            src={src}
            alt={label}
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
}
