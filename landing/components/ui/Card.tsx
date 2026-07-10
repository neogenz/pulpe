import { memo } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  variant?: 'default' | 'elevated' | 'organic'
}

const BASE_STYLES = 'bg-surface p-6'

/* Hover lift is the landing's signature micro-interaction (Mild Bounce Rule):
   feature cards rise slightly on the spring easing. Radius is set per variant so
   the join-only cn() never leaves two conflicting `rounded-*` on one element. */
const HOVER_LIFT =
  'transition-[translate,box-shadow] duration-300 [transition-timing-function:var(--ease-spring)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] motion-reduce:transition-none motion-reduce:translate-y-0'

const VARIANT_STYLES = {
  default: 'rounded-[var(--radius-card)] border border-text/5',
  elevated: `rounded-[var(--radius-card)] shadow-[var(--shadow-card)] ${HOVER_LIFT}`,
  organic: `rounded-[var(--radius-large)] shadow-[var(--shadow-organic)] border border-primary/15 ${HOVER_LIFT}`,
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
