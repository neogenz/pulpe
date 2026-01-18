import { ReactTyped } from 'react-typed'

interface TypeWriterProps {
  strings: string[]
  typeSpeed?: number
  backSpeed?: number
  backDelay?: number
  loop?: boolean
  className?: string
}

/**
 * Animated typing effect that cycles through an array of strings.
 */
export function TypeWriter({
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
}
