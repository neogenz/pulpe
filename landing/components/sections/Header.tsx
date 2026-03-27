'use client'

import { useState, useEffect, useRef, type CSSProperties } from 'react'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { angularUrl } from '@/lib/config'
import { trackCTAClick } from '@/lib/posthog'

const navLinks = [
  { href: '/#features', label: 'Fonctionnalités' },
  { href: '/#how-it-works', label: 'Comment ça marche' },
  { href: '/#platforms', label: 'Télécharger' },
  { href: '/#why-free', label: 'Pourquoi gratuit' },
]

const SCROLL_THRESHOLD = 20
const THROTTLE_MS = 100

const GLASS_DISTORTION_STYLE: CSSProperties = {
  backdropFilter: 'blur(2px)',
  WebkitBackdropFilter: 'blur(2px)',
  filter: 'url(#liquid-glass)',
}

const GLASS_SHINE_STYLE: CSSProperties = {
  boxShadow: `
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.6),
    inset 0 -1px 1px 0 rgba(255, 255, 255, 0.3),
    0 4px 24px rgba(0, 0, 0, 0.08)
  `,
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const lastScrollTime = useRef(0)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    const handleScroll = () => {
      const now = Date.now()
      if (now - lastScrollTime.current < THROTTLE_MS) return
      lastScrollTime.current = now
      setScrolled(window.scrollY > SCROLL_THRESHOLD)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (mobileMenuOpen) {
      wasOpen.current = true
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setMobileMenuOpen(false)
      }
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    } else if (wasOpen.current) {
      wasOpen.current = false
      menuButtonRef.current?.focus({ preventScroll: true })
    }
  }, [mobileMenuOpen])

  return (
      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-4xl">
        <nav
          className="liquidGlass-wrapper relative flex items-center justify-between gap-4 px-4 py-3 md:px-6 md:py-4 rounded-full transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{
            transform: scrolled ? 'scale(0.98) translateY(-2px)' : 'scale(1) translateY(0)',
          }}
          aria-label="Navigation principale"
        >
          {/* Layer 1: Distortion effect — desktop only (causes clipping artifacts on mobile) */}
          <div
            className="liquidGlass-effect absolute inset-0 rounded-full overflow-hidden hidden md:block"
            style={GLASS_DISTORTION_STYLE}
          />

          {/* Layer 2: Tint — opaque on mobile (no blur), glass on desktop */}
          <div
            className={`liquidGlass-tint absolute inset-0 rounded-full transition-colors duration-300 ${
              scrolled ? 'bg-white/90 md:bg-white/70' : 'bg-white/85 md:bg-white/60'
            }`}
          />

          {/* Layer 3: Shine/Reflections */}
          <div
            className="liquidGlass-shine absolute inset-0 rounded-full overflow-hidden pointer-events-none"
            style={GLASS_SHINE_STYLE}
          />

          {/* Top highlight gradient */}
          <div
            className="absolute inset-x-0 top-0 h-1/2 rounded-t-full pointer-events-none"
            style={{
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0) 100%)',
            }}
          />

          {/* Content */}
          <a href="#" className="relative z-10 flex items-center gap-2 font-bold text-lg text-text min-h-[44px]">
            <img src="/icon-64.webp" alt="" aria-hidden="true" width={28} height={28} className="h-7 w-auto" />
            <span>Pulpe</span>
          </a>

          <div className="relative z-10 hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/10 active:bg-primary/20 active:scale-95 rounded-full transition-all duration-200"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="relative z-10 flex items-center gap-2">
            <Button href={angularUrl('/welcome', 'header_essayer')} size="sm" className="rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow" onClick={() => trackCTAClick('essayer', 'header', '/welcome')}>
              Essayer
            </Button>

            <button
              ref={menuButtonRef}
              type="button"
              className="md:hidden p-2.5 text-text-secondary hover:text-text hover:bg-white/30 rounded-full transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </nav>

        {/* Mobile Menu - absolute so it doesn't inflate header's bounding box when collapsed */}
        <div
          className={`md:hidden absolute left-0 right-0 top-full mt-2 rounded-2xl transition-all duration-250 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            mobileMenuOpen
              ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
              : 'opacity-0 -translate-y-2.5 scale-95 pointer-events-none'
          }`}
          {...(mobileMenuOpen && { role: 'dialog', 'aria-modal': true, 'aria-label': 'Menu de navigation' })}
          {...(!mobileMenuOpen && { inert: true })}
        >
          {/* Mobile: Tint — no SVG distortion filter (causes clipping artifacts on mobile) */}
          <div className="absolute inset-0 rounded-2xl bg-white/85 backdrop-blur-sm" />

          {/* Mobile: Shine */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={GLASS_SHINE_STYLE}
          />

          {/* Mobile: Top highlight */}
          <div
            className="absolute inset-x-0 top-0 h-1/3 rounded-t-2xl pointer-events-none"
            style={{
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0) 100%)',
            }}
          />

          <div className="relative z-10 flex flex-col gap-1 p-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-3 text-base font-semibold text-text hover:bg-white/40 active:bg-white/60 rounded-xl transition-all duration-200 active:scale-[0.98]"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </header>
  )
}
