
import { Badge } from './Badge'

const documentStatusVariants: Record<string, { variant: 'default' | 'warning' | 'success' | 'destructive'; label: string }> = {
  DRAFT: { variant: 'warning', label: 'Draft' },
  POSTED: { variant: 'success', label: 'Posted' },
  VOID: { variant: 'destructive', label: 'Void' }
}

const periodStatusVariants: Record<string, { variant: 'success' | 'destructive'; label: string }> = {
  OPEN: { variant: 'success', label: 'Open' },
  CLOSED: { variant: 'destructive', label: 'Closed' }
}

export function DocumentStatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const normalized = status?.toUpperCase() || ''
  const entry = documentStatusVariants[normalized] || { variant: 'default', label: normalized }

  return (
    <Badge className={`uppercase tracking-widest text-[var(--text-main)] ${className}`} variant={entry.variant}>
      {entry.label}
    </Badge>
  )
}

export function PeriodStatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const normalized = status?.toUpperCase() || ''
  const entry = periodStatusVariants[normalized] || { variant: 'default', label: normalized }

  return (
    <Badge className={`uppercase tracking-widest text-[var(--text-main)] ${className}`} variant={entry.variant}>
      {entry.label}
    </Badge>
  )
}
