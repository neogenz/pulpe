import { memo } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  variant?: 'default' | 'elevated' | 'organic'
}

const BASE_STYLES = 'bg-surface rounded-[var(--radius-card)] p-6'

const VARIANT_STYLES = {
  default: 'border border-text/5',
  elevated: 'shadow-[var(--shadow-card)]',
  organic: 'shadow-[var(--shadow-organic)] rounded-[20px] border border-primary/15 hover:shadow-[var(--shadow-card-hover)] transition-shadow duration-300',
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
