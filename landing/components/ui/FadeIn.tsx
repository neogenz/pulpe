'use client'

import { memo, useEffect, useRef, type ReactNode } from 'react'

interface FadeInProps {
  children: ReactNode
  delay?: number
  className?: string
  animateOnMount?: boolean
  noYMovement?: boolean
}

export const FadeIn = memo(function FadeIn({
  children,
  delay = 0,
  className = '',
  animateOnMount = false,
  noYMovement = false,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (animateOnMount) return

    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '-50px', threshold: 0 }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [animateOnMount])

  const delayStyle = delay > 0 ? { transitionDelay: `${delay}s` } : undefined

  if (animateOnMount) {
    const animationClass = noYMovement ? 'animate-fade-in-opacity' : 'animate-fade-in'
    return (
      <div
        className={`${animationClass} ${className}`}
        style={delay > 0 ? { animationDelay: `${delay}s` } : undefined}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={`fade-in-view ${noYMovement ? 'no-y' : ''} ${className}`}
      style={delayStyle}
    >
      {children}
    </div>
  )
})
