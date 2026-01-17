import type { HTMLAttributes, ReactNode } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  variant?: 'primary' | 'accent'
}

export function Badge({
  children,
  variant = 'primary',
  className = '',
  ...props
}: BadgeProps) {
  const variantStyles = {
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-accent/10 text-accent',
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-full ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
