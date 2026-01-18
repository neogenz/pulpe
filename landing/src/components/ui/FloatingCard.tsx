import type { ReactNode, CSSProperties } from 'react'

type FloatingCardVariant = 'stat' | 'notification' | 'badge' | 'highlight'

interface FloatingCardProps {
  variant: FloatingCardVariant
  children: ReactNode
  rotation?: number
  className?: string
}

const variantStyles: Record<FloatingCardVariant, { base: string; colors: string }> = {
  stat: {
    base: 'px-5 py-4 text-sm font-medium',
    colors: 'bg-surface text-text',
  },
  notification: {
    base: 'px-4 py-3 text-sm flex items-center gap-2.5',
    colors: 'bg-surface text-text',
  },
  badge: {
    base: 'px-4 py-2 text-xs font-semibold uppercase tracking-wide',
    colors: 'bg-surface text-text',
  },
  highlight: {
    base: 'px-5 py-4 text-sm font-semibold',
    colors: 'bg-primary text-white',
  },
}

export function FloatingCard({
  variant,
  children,
  rotation = 0,
  className = '',
}: FloatingCardProps) {
  const style: CSSProperties = {
    '--rotation': `${rotation}deg`,
  } as CSSProperties

  const { base, colors } = variantStyles[variant]

  return (
    <div
      className={`
        float-bob
        rounded-[var(--radius-card)]
        shadow-[var(--shadow-floating)]
        ${base}
        ${colors}
        ${className}
      `}
      style={style}
      aria-hidden="true"
    >
      {children}
    </div>
  )
}
