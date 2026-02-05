import React from 'react'

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string
}

export function Checkbox({ label, className = '', ...props }: CheckboxProps) {
    return (
        <label className={`flex items-center space-x-2 cursor-pointer group ${className}`}>
            <input
                type="checkbox"
                className="form-checkbox h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-all duration-200 cursor-pointer group-hover:border-indigo-400"
                {...props}
            />
            <span className="text-slate-700 text-sm font-medium group-hover:text-slate-900 transition-colors">{label}</span>
        </label>
    )
}
