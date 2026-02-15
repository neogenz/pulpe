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
  const firstString = strings[0] ?? ''
  const [text, setText] = useState(firstString)
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'deleting' | 'typing'>('idle')
  const stringIndex = useRef(0)
  const charIndex = useRef(firstString.length)

  useEffect(() => {
    if (strings.length < 2) return
    const timer = setTimeout(() => setPhase('deleting'), backDelay)
    return () => clearTimeout(timer)
  }, [backDelay, strings.length])

  useEffect(() => {
    if (phase === 'idle') return

    if (phase === 'waiting') {
      const timer = setTimeout(() => setPhase('deleting'), backDelay)
      return () => clearTimeout(timer)
    }

    const currentString = strings[stringIndex.current]

    if (phase === 'deleting') {
      charIndex.current--
      setText(currentString.substring(0, charIndex.current))

      if (charIndex.current === 0) {
        stringIndex.current = (stringIndex.current + 1) % strings.length
        setPhase('typing')
        return
      }

      const timeout = setTimeout(() => setPhase('deleting'), backSpeed)
      return () => clearTimeout(timeout)
    }

    if (phase === 'typing') {
      const nextString = strings[stringIndex.current]
      charIndex.current++
      setText(nextString.substring(0, charIndex.current))

      if (charIndex.current === nextString.length) {
        if (!loop && stringIndex.current === strings.length - 1) {
          setPhase('idle')
          return
        }
        setPhase('waiting')
        return
      }

      const timeout = setTimeout(() => setPhase('typing'), typeSpeed)
      return () => clearTimeout(timeout)
    }
  }, [phase, strings, typeSpeed, backSpeed, backDelay, loop])

  return (
    <span className={className}>
      {text}
      <span className="animate-blink">|</span>
    </span>
  )
})
