import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Button } from '../ui'

const navLinks = [
  { href: '#features', label: 'Fonctionnalités' },
  { href: '#how-it-works', label: 'Comment ça marche' },
  { href: '#platforms', label: 'Télécharger' },
  { href: '#why-free', label: 'Pourquoi gratuit' },
]

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-4xl">
      <nav
        className="flex items-center justify-between gap-4 px-4 py-3 md:px-6 md:py-4 rounded-full bg-surface/70 backdrop-blur-xl border border-white/20 shadow-[var(--shadow-glass)]"
        aria-label="Navigation principale"
      >
        <a href="#" className="flex items-center gap-2 font-bold text-lg text-text">
          <img src="/icon.png" alt="" aria-hidden="true" className="h-7 w-auto" />
          <span>Pulpe</span>
        </a>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-text-secondary hover:text-text transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button className="text-sm px-4 py-2 min-h-[40px] rounded-full">
            Essayer
          </Button>

          <button
            type="button"
            className="md:hidden p-2 text-text-secondary hover:text-text transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="md:hidden mt-2 p-4 rounded-2xl bg-surface/90 backdrop-blur-xl border border-white/20 shadow-[var(--shadow-glass)]"
          >
            <div className="flex flex-col gap-2">
              {navLinks.map((link, index) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="px-4 py-3 text-sm text-text-secondary hover:text-text hover:bg-white/10 rounded-xl transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </motion.a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
