import React from 'react'

export function Card({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={`bg-[var(--bg-surface)] border border-[var(--border)] shadow-[0_2px_10px_rgba(0,0,0,0.03)] rounded-lg hover:shadow-[0_5px_15px_rgba(0,0,0,0.05)] transition-shadow duration-300 ${className}`}>
            {children}
        </div>
    )
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    return <div className={`p-6 pb-4 border-b border-[var(--border)] ${className}`}>{children}</div>
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    return <h3 className={`text-lg font-semibold text-[var(--text-main)] tracking-tight ${className}`}>{children}</h3>
}

export function CardDescription({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    return <p className={`text-sm text-[var(--text-muted)] mt-1 ${className}`}>{children}</p>
}

export function CardContent({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    return <div className={`p-6 pt-4 ${className}`}>{children}</div>
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    return <div className={`p-4 bg-[var(--bg-surface-alt)] border-t border-[var(--border)] flex items-center rounded-b-lg ${className}`}>{children}</div>
}
