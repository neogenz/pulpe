import { ChevronDown } from 'lucide-react'
import { type ReactNode } from 'react'

interface AccordionItemProps {
  question: string
  answer: ReactNode
}

// `<details>` porte nativement l'état ouvert, la commande clavier et l'annonce
// lecteur d'écran. Surtout, il répond dès le premier affichage : la FAQ
// n'attend plus l'hydratation, mesurée à 3,2 s sur mobile. Le composant n'a
// plus d'état, donc plus de directive client, et sort du bundle.
export function AccordionItem({ question, answer }: AccordionItemProps) {
  return (
    <details className="group overflow-hidden rounded-[var(--radius-card)] border border-text/5 bg-surface">
      <summary className="flex w-full cursor-pointer select-none items-center justify-between p-5 text-left font-medium text-text transition-colors duration-200 hover:bg-primary/5 active:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary motion-reduce:transition-none list-none [&::-webkit-details-marker]:hidden">
        <span>{question}</span>
        <span
          aria-hidden="true"
          className="ml-4 shrink-0 text-text-secondary transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
        >
          <ChevronDown className="w-5 h-5" />
        </span>
      </summary>
      {/* Le contenu reste affiché pour conserver l'animation de hauteur : le
          `display: none` natif d'un `<details>` replié ne se transitionne pas.
          `invisible` le retire alors de l'arbre d'accessibilité tant qu'il est
          replié, ce que faisait l'ancien `aria-hidden`. */}
      <div className="invisible grid grid-rows-[0fr] transition-[grid-template-rows,visibility] duration-200 ease-out group-open:visible group-open:grid-rows-[1fr] motion-reduce:transition-none">
        <div className="overflow-hidden">
          <div className="px-5 pb-5 text-text-secondary leading-relaxed">{answer}</div>
        </div>
      </div>
    </details>
  )
}
