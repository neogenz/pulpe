import { memo } from 'react'
import { ReactTyped } from 'react-typed'

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
  return (
    <ReactTyped
      strings={strings}
      typeSpeed={typeSpeed}
      backSpeed={backSpeed}
      backDelay={backDelay}
      loop={loop}
      smartBackspace
      showCursor
      cursorChar="|"
      className={className}
    />
  )
})
