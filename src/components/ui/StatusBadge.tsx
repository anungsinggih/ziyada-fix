
import { Badge } from './Badge'

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'

const statusVariants: Record<string, { variant: BadgeVariant; label: string }> = {
  DRAFT: { variant: 'warning', label: 'Draft' },
  POSTED: { variant: 'success', label: 'Posted' },
  VOID: { variant: 'destructive', label: 'Void' },
  OPEN: { variant: 'success', label: 'Open' },
  CLOSED: { variant: 'destructive', label: 'Closed' },
  UNPAID: { variant: 'warning', label: 'Unpaid' },
  PARTIAL: { variant: 'warning', label: 'Partial' },
  PAID: { variant: 'success', label: 'Paid' },
  ACTIVE: { variant: 'success', label: 'Active' },
  INACTIVE: { variant: 'secondary', label: 'Inactive' },
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const normalized = status?.toUpperCase() || ''
  const entry = statusVariants[normalized]
  const label = entry?.label || toTitleCase(normalized)
  const variant = entry?.variant || 'secondary'

  return (
    <Badge className={`uppercase tracking-widest text-[var(--text-main)] ${className}`} variant={variant}>
      {label}
    </Badge>
  )
}

export function DocumentStatusBadge({ status, className = '' }: { status: string; className?: string }) {
  return <StatusBadge status={status} className={className} />
}

export function PeriodStatusBadge({ status, className = '' }: { status: string; className?: string }) {
  return <StatusBadge status={status} className={className} />
}
