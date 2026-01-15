import React from 'react'

export function Table({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    return (
        <div className="w-full overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className={`min-w-full w-full text-sm text-left whitespace-nowrap ${className}`}>
                {children}
            </table>
        </div>
    )
}

export function TableHead({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    return <thead className={`bg-[var(--bg-surface-alt)] uppercase text-xs font-semibold text-[var(--text-muted)] border-b border-[var(--border)] ${className}`}>{children}</thead>
}

export function TableBody({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    return <tbody className={`divide-y divide-[var(--border)] bg-white ${className}`}>{children}</tbody>
}

export function TableRow({ children, className = '', onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) {
    return (
        <tr
            className={`transition-colors hover:bg-[#F5F7FA] even:bg-[#F9FAFB] ${onClick ? 'cursor-pointer' : ''} ${className}`}
            onClick={onClick}
        >
            {children}
        </tr>
    )
}

export function TableHeader({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    return <th className={`px-4 py-3 font-semibold text-[var(--text-main)] ${className}`}>{children}</th>
}

export function TableCell({ children, className = '', colSpan }: { children: React.ReactNode, className?: string, colSpan?: number }) {
    return <td colSpan={colSpan} className={`px-4 py-3 align-middle text-[var(--text-main)] ${className}`}>{children}</td>
}
