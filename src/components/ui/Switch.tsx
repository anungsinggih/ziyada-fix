import React from 'react'

interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    label?: string
    onCheckedChange?: (checked: boolean) => void
}

export function Switch({ label, className = '', onCheckedChange, checked, ...props }: SwitchProps) {
    return (
        <label className={`flex items-center space-x-3 cursor-pointer ${className}`}>
            {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
            <div className="relative">
                <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={(e) => onCheckedChange?.(e.target.checked)}
                    {...props}
                />
                <div className={`block w-10 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'translate-x-4' : ''}`}></div>
            </div>
        </label>
    )
}
