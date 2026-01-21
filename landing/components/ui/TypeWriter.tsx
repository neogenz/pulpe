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
  const [text, setText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const stringIndex = useRef(0)
  const charIndex = useRef(0)

  useEffect(() => {
    const currentString = strings[stringIndex.current]

    const tick = () => {
      if (isDeleting) {
        charIndex.current--
        setText(currentString.substring(0, charIndex.current))

        if (charIndex.current === 0) {
          setIsDeleting(false)
          stringIndex.current = (stringIndex.current + 1) % strings.length
        }
      } else {
        charIndex.current++
        setText(currentString.substring(0, charIndex.current))

        if (charIndex.current === currentString.length) {
          if (!loop && stringIndex.current === strings.length - 1) return
          setTimeout(() => setIsDeleting(true), backDelay)
          return
        }
      }
    }

    const timeout = setTimeout(tick, isDeleting ? backSpeed : typeSpeed)
    return () => clearTimeout(timeout)
  }, [text, isDeleting, strings, typeSpeed, backSpeed, backDelay, loop])

  return (
    <span className={className}>
      {text}
      <span className="animate-blink">|</span>
    </span>
  )
})
