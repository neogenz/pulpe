'use client'

import { memo, useEffect, useRef, type ReactNode } from 'react'

interface FadeInProps {
  children: ReactNode
  delay?: number
  className?: string
  animateOnMount?: boolean
  variant?: 'default' | 'blur'
}

export const FadeIn = memo(function FadeIn({
  children,
  delay = 0,
  className = '',
  animateOnMount = false,
  variant = 'default',
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (animateOnMount) return

    const element = ref.current
    if (!element) return

    // If element is already scrolled past (browser scroll restoration), show immediately
    if (element.getBoundingClientRect().bottom < 0) {
      if (variant === 'blur') {
        element.classList.remove('opacity-0')
      } else {
        element.classList.add('is-visible')
      }
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (variant === 'blur') {
              entry.target.classList.add('animate-blur-in')
            } else {
              entry.target.classList.add('is-visible')
            }
            observer.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '-50px', threshold: 0 }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [animateOnMount, variant])

  const delayStyle = delay > 0
    ? { [variant === 'blur' ? 'animationDelay' : 'transitionDelay']: `${delay}s` }
    : undefined

  if (animateOnMount) {
    const animationClass =
      variant === 'blur' ? 'animate-blur-in' : 'animate-fade-in'
    return (
      <div
        className={`${animationClass} ${className}`}
        style={delay > 0 ? { animationDelay: `${delay}s` } : undefined}
      >
        {children}
      </div>
    )
  }

  const scrollClass =
    variant === 'blur' ? 'opacity-0' : 'fade-in-view'

  return (
    <div
      ref={ref}
      className={`${scrollClass} ${className}`}
      style={delayStyle}
    >
      {children}
    </div>
  )
})
