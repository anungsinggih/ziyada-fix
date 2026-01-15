import React from 'react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string
    options: { label: string, value: string | number }[]
}

export function Select({ label, options, className = '', ...props }: SelectProps) {
    return (
        <div className="flex flex-col gap-1.5 mb-3 w-full">
            {label && <label className="text-sm font-medium text-[var(--text-main)]">{label}</label>}
            <select
                className={`flex h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-100 ${className}`}
                {...props}
            >
                {options.map((opt, idx) => (
                    <option key={idx} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    )
}
