interface ScreenshotProps {
  label: string
  className?: string
}

export function Screenshot({ label, className = '' }: ScreenshotProps) {
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
