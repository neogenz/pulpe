'use client'

import { memo, useEffect, useState } from 'react'

interface TypeWriterProps {
  strings: string[]
  typeSpeed?: number
  backSpeed?: number
  backDelay?: number
  loop?: boolean
  className?: string
}

export const TypeWriter = memo(function TypeWriter({
  strings,
  typeSpeed = 80,
  backSpeed = 40,
  backDelay = 1500,
  loop = true,
  className,
}: TypeWriterProps) {
  const firstString = strings[0] ?? ''
  const [text, setText] = useState(firstString)

  useEffect(() => {
    if (strings.length < 2) return

    let stringIndex = 0
    let charIndex = strings[0].length
    let phase: 'waiting' | 'deleting' | 'typing' = 'waiting'
    let timeoutId: ReturnType<typeof setTimeout>

    const tick = () => {
      if (phase === 'waiting') {
        timeoutId = setTimeout(() => {
          phase = 'deleting'
          tick()
        }, backDelay)
        return
      }

      if (phase === 'deleting') {
        charIndex--
        setText(strings[stringIndex].substring(0, charIndex))

        if (charIndex === 0) {
          stringIndex = (stringIndex + 1) % strings.length
          phase = 'typing'
        }

        timeoutId = setTimeout(tick, backSpeed)
        return
      }

      if (phase === 'typing') {
        charIndex++
        setText(strings[stringIndex].substring(0, charIndex))

        if (charIndex === strings[stringIndex].length) {
          if (!loop && stringIndex === strings.length - 1) return
          phase = 'waiting'
          timeoutId = setTimeout(tick, backDelay)
          return
        }

        timeoutId = setTimeout(tick, typeSpeed)
      }
    }

    timeoutId = setTimeout(tick, backDelay)
    return () => clearTimeout(timeoutId)
  }, [strings, typeSpeed, backSpeed, backDelay, loop])

  return (
    <span className={className}>
      {text}
      <span className="animate-blink">|</span>
    </span>
  )
})
