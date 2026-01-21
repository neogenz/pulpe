'use client'

import { memo, useEffect, useState, useRef } from 'react'

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
  // Start with first string to avoid hydration mismatch
  const [text, setText] = useState(strings[0])
  const [phase, setPhase] = useState<'idle' | 'deleting' | 'typing'>('idle')
  const stringIndex = useRef(0)
  const charIndex = useRef(strings[0].length)

  // Start animation after hydration with a delay
  useEffect(() => {
    const timer = setTimeout(() => setPhase('deleting'), backDelay)
    return () => clearTimeout(timer)
  }, [backDelay])

  useEffect(() => {
    if (phase === 'idle') return

    const currentString = strings[stringIndex.current]

    const tick = () => {
      if (phase === 'deleting') {
        charIndex.current--
        setText(currentString.substring(0, charIndex.current))

        if (charIndex.current === 0) {
          stringIndex.current = (stringIndex.current + 1) % strings.length
          setPhase('typing')
        }
      } else if (phase === 'typing') {
        const nextString = strings[stringIndex.current]
        charIndex.current++
        setText(nextString.substring(0, charIndex.current))

        if (charIndex.current === nextString.length) {
          if (!loop && stringIndex.current === strings.length - 1) {
            setPhase('idle')
            return
          }
          setTimeout(() => setPhase('deleting'), backDelay)
          setPhase('idle')
        }
      }
    }

    const speed = phase === 'deleting' ? backSpeed : typeSpeed
    const timeout = setTimeout(tick, speed)
    return () => clearTimeout(timeout)
  }, [text, phase, strings, typeSpeed, backSpeed, backDelay, loop])

  return (
    <span className={className}>
      {text}
      <span className="animate-blink">|</span>
    </span>
  )
})
