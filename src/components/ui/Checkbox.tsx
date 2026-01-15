import React from 'react'

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string
}

export function Checkbox({ label, className = '', ...props }: CheckboxProps) {
    return (
        <label className={`flex items-center space-x-2 cursor-pointer ${className}`}>
            <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                {...props}
            />
            <span className="text-gray-900 text-sm">{label}</span>
        </label>
    )
}
