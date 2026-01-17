interface ScreenshotProps {
  src?: string
  label: string
  className?: string
}

export function Screenshot({ src, label, className = '' }: ScreenshotProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={label}
        className={`rounded-[var(--radius-large)] shadow-[var(--shadow-screenshot)] ${className}`}
      />
    )
  }

  return (
    <div
      className={`bg-surface-alt rounded-[var(--radius-large)] shadow-[var(--shadow-screenshot)] flex items-center justify-center text-text-secondary text-sm font-medium ${className}`}
      role="img"
      aria-label={label}
    >
      [Screenshot: {label}]
    </div>
  )
}
