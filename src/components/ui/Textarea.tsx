import React from 'react'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string
}

export function Textarea({ label, className = '', ...props }: TextareaProps) {
    return (
        <div className="flex flex-col gap-1.5 mb-3 w-full">
            {label && <label className="text-sm font-medium text-[var(--text-main)]">{label}</label>}
            <textarea
                className={`flex w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-[var(--primary)] hover:border-gray-300 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-50 min-h-[80px] shadow-sm resize-y ${className}`}
                {...props}
            />
        </div>
    )
}
