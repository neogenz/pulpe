import { memo } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  variant?: 'default' | 'elevated'
}

const BASE_STYLES = 'bg-surface rounded-[var(--radius-card)] p-6'

const VARIANT_STYLES = {
  default: 'border border-text/5',
  elevated: 'shadow-[var(--shadow-card)]',
} as const

export const Card = memo(function Card({
  children,
  variant = 'default',
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={cn(BASE_STYLES, VARIANT_STYLES[variant], className)}
      {...props}
    >
      {children}
    </div>
  )
})
