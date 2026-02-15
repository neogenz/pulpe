import { memo } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { Container } from './Container'

interface SectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  background?: 'default' | 'alt' | 'primary' | 'grain'
}

const BACKGROUND_STYLES = {
  default: 'bg-background',
  alt: 'bg-surface-alt',
  primary: 'bg-primary text-white',
  grain: 'section-grain',
} as const

export const Section = memo(function Section({
  children,
  background = 'default',
  className = '',
  ...props
}: SectionProps) {
  return (
    <section
      className={`py-16 md:py-20 lg:py-24 ${BACKGROUND_STYLES[background]} ${className}`}
      {...props}
    >
      <Container className="relative z-10">{children}</Container>
    </section>
  )
})
