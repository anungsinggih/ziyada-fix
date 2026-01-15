import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    containerClassName?: string
}

export function Input({ label, className = '', containerClassName = '', ...props }: InputProps) {
    return (
        <div className={`flex flex-col gap-1.5 mb-3 w-full ${containerClassName}`}>
            {label && <label className="text-sm font-medium text-[var(--text-main)]">{label}</label>}
            <input
                className={`flex h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-100 ${className}`}
                {...props}
            />
        </div>
    )
}
