import { memo } from "react";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse";

type ButtonBaseProps = {
  variant?: ButtonVariant;
  size?: "sm" | "default";
  glow?: boolean;
  children: ReactNode;
  className?: string;
};

type ButtonAsButton = ButtonBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps> & {
    href?: never;
  };
type ButtonAsAnchor = ButtonBaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonBaseProps> & {
    href: string;
  };

type ButtonProps = ButtonAsButton | ButtonAsAnchor;

const BASE_STYLES =
  "inline-flex items-center justify-center rounded-full font-bold tracking-[-0.02em] transition-[background-color,color,box-shadow,scale,translate] duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none [transition-timing-function:var(--ease-smooth)] motion-reduce:transition-none motion-reduce:scale-100 motion-reduce:translate-y-0";

const SIZE_STYLES = {
  sm: "min-h-[44px] px-4 text-sm",
  default:
    "max-w-full min-h-[52px] px-6 py-3 text-center text-base leading-snug whitespace-normal min-[620px]:whitespace-nowrap min-[940px]:min-h-[56px] min-[940px]:px-8 min-[940px]:text-lg",
} as const;

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary shadow-[0_5px_18px_rgba(0,110,37,0.24)] active:scale-[0.96] active:shadow-[0_2px_8px_rgba(0,110,37,0.20)] md:hover:-translate-y-0.5 md:hover:bg-primary-hover",
  secondary:
    "bg-surface text-text border border-text/10 hover:bg-surface-alt active:scale-[0.96]",
  ghost:
    "bg-transparent text-primary hover:bg-primary/5 underline-offset-4 hover:underline",
  inverse:
    "bg-white text-primary-strong shadow-[0_4px_18px_rgba(0,60,20,0.16)] active:scale-[0.96] md:hover:-translate-y-0.5 md:hover:bg-white/90",
};

export const Button = memo(function Button({
  variant = "primary",
  size = "default",
  glow = false,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const classes = cn(
    BASE_STYLES,
    SIZE_STYLES[size],
    VARIANT_STYLES[variant],
    glow && variant === "primary" && "glow-primary",
    className,
  );

  if ("href" in props && props.href) {
    const { href, ...anchorProps } = props as ButtonAsAnchor;
    return (
      <a href={href} className={classes} {...anchorProps}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} {...(props as ButtonAsButton)}>
      {children}
    </button>
  );
});
