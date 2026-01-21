'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { ANGULAR_APP_URL } from '@/lib/config'

const navLinks = [
  { href: '#features', label: 'Fonctionnalités' },
  { href: '#how-it-works', label: 'Comment ça marche' },
  { href: '#platforms', label: 'Télécharger' },
  { href: '#why-free', label: 'Pourquoi gratuit' },
]

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      {/* SVG Filter for liquid glass distortion effect */}
      <svg className="absolute w-0 h-0 overflow-hidden" aria-hidden="true">
        <defs>
          <filter id="liquid-glass" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
            {/* Create fractal noise for distortion */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.012"
              numOctaves="3"
              seed="5"
              result="noise"
            />
            {/* Enhance the noise contrast */}
            <feComponentTransfer in="noise" result="enhanced">
              <feFuncR type="gamma" amplitude="1" exponent="8" offset="0" />
              <feFuncG type="gamma" amplitude="1" exponent="8" offset="0" />
            </feComponentTransfer>
            {/* Soften the displacement map */}
            <feGaussianBlur in="enhanced" stdDeviation="2" result="blurred" />
            {/* Apply displacement to create refraction */}
            <feDisplacementMap
              in="SourceGraphic"
              in2="blurred"
              scale="12"
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            {/* Add specular lighting for glass shine */}
            <feSpecularLighting
              in="blurred"
              surfaceScale="2"
              specularConstant="0.8"
              specularExponent="20"
              lightingColor="white"
              result="specular"
            >
              <fePointLight x="-100" y="-100" z="200" />
            </feSpecularLighting>
            {/* Blend specular with displaced image */}
            <feComposite in="specular" in2="displaced" operator="arithmetic" k1="0" k2="1" k3="0.15" k4="0" result="lit" />
            <feBlend in="displaced" in2="lit" mode="screen" />
          </filter>
        </defs>
      </svg>

      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-4xl">
        <motion.nav
          initial={false}
          animate={{
            scale: scrolled ? 0.98 : 1,
            y: scrolled ? -2 : 0,
          }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="liquidGlass-wrapper relative flex items-center justify-between gap-4 px-4 py-3 md:px-6 md:py-4 rounded-full"
          aria-label="Navigation principale"
        >
          {/* Layer 1: Distortion effect */}
          <div
            className="liquidGlass-effect absolute inset-0 rounded-full overflow-hidden"
            style={{
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
              filter: 'url(#liquid-glass)',
            }}
          />

          {/* Layer 2: Tint */}
          <div
            className="liquidGlass-tint absolute inset-0 rounded-full"
            style={{
              background: `rgba(255, 255, 255, ${scrolled ? 0.2 : 0.15})`,
            }}
          />

          {/* Layer 3: Shine/Reflections */}
          <div
            className="liquidGlass-shine absolute inset-0 rounded-full overflow-hidden pointer-events-none"
            style={{
              boxShadow: `
                inset 0 1px 1px 0 rgba(255, 255, 255, 0.6),
                inset 0 -1px 1px 0 rgba(255, 255, 255, 0.3),
                0 4px 24px rgba(0, 0, 0, 0.08)
              `,
            }}
          />

          {/* Top highlight gradient */}
          <div
            className="absolute inset-x-0 top-0 h-1/2 rounded-t-full pointer-events-none"
            style={{
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0) 100%)',
            }}
          />

          {/* Content */}
          <a href="#" className="relative z-10 flex items-center gap-2 font-bold text-lg text-text">
            <img src="/icon.png" alt="" aria-hidden="true" className="h-7 w-auto" />
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
            <a href={`${ANGULAR_APP_URL}/welcome`}>
              <Button className="text-sm px-4 py-2 min-h-[40px] rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow">
                Essayer
              </Button>
            </a>

            <button
              type="button"
              className="md:hidden p-2 text-text-secondary hover:text-text hover:bg-white/30 rounded-full transition-all duration-200 active:scale-95"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </motion.nav>

        {/* Mobile Menu - Liquid Glass */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="md:hidden mt-2 rounded-2xl relative"
            >
              {/* Mobile: Distortion */}
              <div
                className="absolute inset-0 rounded-2xl overflow-hidden"
                style={{
                  backdropFilter: 'blur(2px)',
                  WebkitBackdropFilter: 'blur(2px)',
                  filter: 'url(#liquid-glass)',
                }}
              />

              {/* Mobile: Tint */}
              <div
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.8)',
                }}
              />

              {/* Mobile: Shine */}
              <div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  boxShadow: `
                    inset 0 1px 1px 0 rgba(255, 255, 255, 0.6),
                    inset 0 -1px 1px 0 rgba(255, 255, 255, 0.3),
                    0 4px 24px rgba(0, 0, 0, 0.08)
                  `,
                }}
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
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  )
}
