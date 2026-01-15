import React from 'react'
import { Icons } from './Icons'

type AlertVariant = 'info' | 'success' | 'error' | 'warning'

interface AlertProps {
  title?: string
  description?: React.ReactNode
  variant?: AlertVariant
  className?: string
}

const variantMap: Record<AlertVariant, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  info: {
    bg: 'bg-slate-50',
    text: 'text-slate-800',
    border: 'border border-slate-200',
    icon: <Icons.Info className="w-5 h-5" />
  },
  success: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border border-emerald-200',
    icon: <Icons.Check className="w-5 h-5" />
  },
  error: {
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border border-rose-200',
    icon: <Icons.Warning className="w-5 h-5" />
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border border-amber-200',
    icon: <Icons.AlertCircle className="w-5 h-5" />
  }
}

export function Alert({ title, description, variant = 'info', className = '' }: AlertProps) {
  const selected = variantMap[variant]

  return (
    <div className={`rounded-lg px-4 py-3 flex items-start gap-3 ${selected.bg} ${selected.text} ${selected.border} ${className}`}>
      <span className="shrink-0 mt-0.5">{selected.icon}</span>
      <div className="flex-1 space-y-1">
        {title && <p className="text-sm font-semibold">{title}</p>}
        {description && <p className="text-sm leading-relaxed text-current/90">{description}</p>}
      </div>
    </div>
  )
}
