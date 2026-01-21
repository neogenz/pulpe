import { memo } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  variant?: 'primary' | 'accent'
}

const VARIANT_STYLES = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
} as const

export const Badge = memo(function Badge({
  children,
  variant = 'primary',
  className = '',
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-full ${VARIANT_STYLES[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
})
