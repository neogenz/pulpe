import type { HTMLAttributes, ReactNode } from 'react'

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Container({ children, className = '', ...props }: ContainerProps) {
  return (
    <div
      className={`w-full max-w-6xl mx-auto px-4 md:px-6 lg:px-8 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
