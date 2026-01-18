import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  children: ReactNode
}

export function Button({
  variant = 'primary',
  children,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold transition-all duration-200 ease-out rounded-[var(--radius-button)] min-h-[56px] px-8 text-lg cursor-pointer'

  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      'bg-primary text-white shadow-[0_4px_14px_rgba(0,110,37,0.4)] active:shadow-[0_2px_8px_rgba(0,110,37,0.3)] active:scale-[0.98] md:shadow-none md:active:shadow-none md:hover:bg-primary-hover md:hover:scale-[1.02]',
    secondary:
      'bg-surface text-text border border-text/10 hover:bg-surface-alt hover:scale-[1.02] active:scale-[0.98]',
    ghost:
      'bg-transparent text-primary hover:bg-primary/5 underline-offset-4 hover:underline',
  }

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
