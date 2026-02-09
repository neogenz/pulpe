'use client'

import { ChevronDown } from 'lucide-react'
import { memo, useId, useState } from 'react'

interface AccordionItemProps {
  question: string
  answer: string
}

export const AccordionItem = memo(function AccordionItem({ question, answer }: AccordionItemProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const triggerId = `${id}-trigger`
  const panelId = `${id}-panel`

  const toggle = () => setOpen((prev) => !prev)

  return (
    <div className="bg-surface rounded-[var(--radius-card)] border border-text/5">
      <button
        type="button"
        id={triggerId}
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between cursor-pointer p-5 text-text font-medium select-none text-left"
      >
        <span>{question}</span>
        <span
          aria-hidden="true"
          className={`ml-4 shrink-0 text-text-secondary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <ChevronDown className="w-5 h-5" />
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 text-text-secondary leading-relaxed">{answer}</div>
        </div>
      </div>
    </div>
  )
})
