import React from 'react'

interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    label?: string
    onCheckedChange?: (checked: boolean) => void
}

export function Switch({ label, className = '', onCheckedChange, checked, ...props }: SwitchProps) {
    return (
        <label className={`flex items-center space-x-3 cursor-pointer group ${className}`}>
            {label && <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">{label}</span>}
            <div className="relative inline-flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={checked}
                    onChange={(e) => onCheckedChange?.(e.target.checked)}
                    {...props}
                />
                <div className={`
                    w-11 h-6 rounded-full transition-colors duration-200 ease-in-out
                    peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/10
                    ${checked ? 'bg-indigo-600' : 'bg-slate-200 group-hover:bg-slate-300'}
                `}></div>
                <div className={`
                    absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow-sm 
                    transition-transform duration-200 ease-in-out
                    ${checked ? 'translate-x-5' : ''}
                `}></div>
            </div>
        </label>
    )
}
