import { memo } from 'react'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'inverse'

type ButtonBaseProps = {
  variant?: ButtonVariant
  size?: 'sm' | 'default'
  glow?: boolean
  children: ReactNode
  className?: string
}

type ButtonAsButton = ButtonBaseProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps> & { href?: never }
type ButtonAsAnchor = ButtonBaseProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonBaseProps> & { href: string }

type ButtonProps = ButtonAsButton | ButtonAsAnchor

const BASE_STYLES =
  'inline-flex items-center justify-center font-semibold transition-all duration-200 ease-out rounded-[var(--radius-button)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none'

const SIZE_STYLES = {
  sm: 'min-h-[44px] px-4 text-sm',
  default: 'min-h-[48px] px-5 text-base lg:min-h-[56px] lg:px-8 lg:text-lg whitespace-nowrap',
} as const

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white shadow-[0_4px_14px_rgba(0,110,37,0.4)] active:shadow-[0_2px_8px_rgba(0,110,37,0.3)] active:scale-[0.98] md:shadow-none md:active:shadow-none md:hover:bg-primary-hover md:hover:scale-[1.02]',
  secondary:
    'bg-surface text-text border border-text/10 hover:bg-surface-alt hover:scale-[1.02] active:scale-[0.98]',
  ghost:
    'bg-transparent text-primary hover:bg-primary/5 underline-offset-4 hover:underline',
  inverse:
    'bg-white text-primary shadow-[0_4px_20px_rgba(0,0,0,0.15)] active:scale-[0.98] md:hover:bg-white/90 md:hover:scale-[1.02] md:hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]',
}

export const Button = memo(function Button({
  variant = 'primary',
  size = 'default',
  glow = false,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const classes = cn(
    BASE_STYLES,
    SIZE_STYLES[size],
    VARIANT_STYLES[variant],
    glow && variant === 'primary' && 'glow-primary',
    className
  )

  if ('href' in props && props.href) {
    const { href, ...anchorProps } = props as ButtonAsAnchor
    return (
      <a href={href} className={classes} {...anchorProps}>
        {children}
      </a>
    )
  }

  return (
    <button className={classes} {...(props as ButtonAsButton)}>
      {children}
    </button>
  )
})
