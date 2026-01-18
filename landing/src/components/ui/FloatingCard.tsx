import type { ReactNode } from 'react'
import { Check, Wallet, TrendingUp } from 'lucide-react'

interface FloatingCardProps {
  children?: ReactNode
  rotation?: number
  delay?: number
  className?: string
}

interface NotificationCardProps {
  icon?: ReactNode
  text: string
}

interface StatCardProps {
  icon?: ReactNode
  label: string
  value: string
}

interface BadgeCardProps {
  icon?: ReactNode
  text: string
}

interface MiniChartCardProps {
  label: string
  data?: number[]
}

export function FloatingCard({
  children,
  rotation = 0,
  delay = 0,
  className = '',
}: FloatingCardProps) {
  const baseStyles = `
    bg-surface rounded-[var(--radius-card)] shadow-[var(--shadow-floating)]
    px-4 py-3 flex items-center gap-3 animate-float-bob
  `

  return (
    <div
      className={`${baseStyles} ${className}`}
      style={{
        transform: `rotate(${rotation}deg)`,
        animationDelay: `${delay}s`,
      }}
    >
      {children}
    </div>
  )
}

export function NotificationCard({ icon, text }: NotificationCardProps) {
  return (
    <>
      <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
        {icon || <Check size={14} />}
      </span>
      <span className="text-sm font-medium text-text">{text}</span>
    </>
  )
}

export function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <>
      <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
        {icon || <Wallet size={16} />}
      </span>
      <div className="flex flex-col">
        <span className="text-xs text-text-secondary">{label}</span>
        <span className="text-sm font-semibold text-text">{value}</span>
      </div>
    </>
  )
}

export function BadgeCard({ icon, text }: BadgeCardProps) {
  return (
    <>
      <span className="w-5 h-5 flex items-center justify-center text-primary">
        {icon || <TrendingUp size={14} />}
      </span>
      <span className="text-xs font-medium text-text">{text}</span>
    </>
  )
}

export function MiniChartCard({ label, data = [30, 45, 35, 60, 50, 70, 65] }: MiniChartCardProps) {
  const maxValue = Math.max(...data)
  const minValue = Math.min(...data)
  const range = maxValue - minValue || 1

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 60
      const y = 20 - ((value - minValue) / range) * 16
      return `${x},${y}`
    })
    .join(' ')

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-text-secondary">{label}</span>
        <svg width="60" height="24" viewBox="0 0 60 24" className="text-primary">
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </>
  )
}
