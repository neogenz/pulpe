import type { HTMLAttributes, ReactNode } from 'react'
import { Container } from './Container'

interface SectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  background?: 'default' | 'alt' | 'primary'
}

export function Section({
  children,
  background = 'default',
  className = '',
  ...props
}: SectionProps) {
  const backgroundStyles = {
    default: 'bg-background',
    alt: 'bg-surface-alt',
    primary: 'bg-primary text-white',
  }

  return (
    <section
      className={`py-16 md:py-20 lg:py-24 ${backgroundStyles[background]} ${className}`}
      {...props}
    >
      <Container>{children}</Container>
    </section>
  )
}
