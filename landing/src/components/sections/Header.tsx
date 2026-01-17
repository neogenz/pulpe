import { Button } from '../ui'

export function Header() {
  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-4xl">
      <nav
        className="flex items-center justify-between gap-4 px-4 py-3 md:px-6 md:py-4 rounded-full bg-surface/70 backdrop-blur-xl border border-white/20 shadow-[var(--shadow-glass)]"
        aria-label="Navigation principale"
      >
        <a href="#" className="flex items-center gap-2 font-bold text-lg text-text">
          <span className="text-2xl" role="img" aria-hidden="true">🍊</span>
          <span className="hidden sm:inline">Pulpe</span>
        </a>

        <div className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-sm text-text-secondary hover:text-text transition-colors">
            Fonctionnalités
          </a>
          <a href="#how-it-works" className="text-sm text-text-secondary hover:text-text transition-colors">
            Comment ça marche
          </a>
          <a href="#why-free" className="text-sm text-text-secondary hover:text-text transition-colors">
            Pourquoi gratuit
          </a>
        </div>

        <Button className="text-sm px-4 py-2 min-h-[40px]">
          Essayer
        </Button>
      </nav>
    </header>
  )
}
