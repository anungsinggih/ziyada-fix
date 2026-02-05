import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    containerClassName?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, className = '', containerClassName = '', ...props }, ref) => {
    return (
        <div className={`flex flex-col gap-1.5 mb-3 w-full ${containerClassName}`}>
            {label && <label className="text-sm font-medium text-[var(--text-main)]">{label}</label>}
            <input
                ref={ref}
                className={`flex h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-[var(--primary)] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 shadow-sm hover:border-gray-300 ${className}`}
                {...props}
            />
        </div>
    )
})
Input.displayName = 'Input'
