'use client'

import { ChevronDown } from 'lucide-react'
import { type ReactNode, memo, useId, useState } from 'react'

interface AccordionItemProps {
  question: string
  answer: ReactNode
}

export const AccordionItem = memo(function AccordionItem({ question, answer }: AccordionItemProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const triggerId = `${id}-trigger`
  const panelId = `${id}-panel`

  const toggle = () => setOpen((prev) => !prev)

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-text/5 bg-surface">
      <button
        type="button"
        id={triggerId}
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full cursor-pointer select-none items-center justify-between p-5 text-left font-medium text-text transition-colors duration-200 hover:bg-primary/5 active:bg-primary/10 motion-reduce:transition-none"
      >
        <span>{question}</span>
        <span
          aria-hidden="true"
          className={`ml-4 shrink-0 text-text-secondary transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        >
          <ChevronDown className="w-5 h-5" />
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        aria-hidden={!open}
        className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 text-text-secondary leading-relaxed">{answer}</div>
        </div>
      </div>
    </div>
  )
})
