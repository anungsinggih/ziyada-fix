import React from 'react'
import { Icons } from './Icons'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost' | 'success'
    size?: 'sm' | 'md' | 'lg' | 'icon'
    icon?: React.ReactNode
    isLoading?: boolean
}

export function Button({ variant = 'primary', size = 'md', icon, isLoading, children, className = '', ...props }: ButtonProps) {
    const baseStyles = "inline-flex items-center justify-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border"

    const variants = {
        primary: "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] border-transparent focus:ring-[var(--primary)]",
        secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200 border-transparent focus:ring-gray-500",
        danger: "bg-[var(--danger)] text-white hover:bg-[var(--danger-hover)] border-transparent focus:ring-[var(--danger)]",
        success: "bg-[var(--success)] text-white hover:bg-[var(--success-hover)] border-transparent focus:ring-[var(--success)]",
        outline: "bg-white border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-surface-alt)] focus:ring-gray-400",
        ghost: "bg-transparent border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-gray-100"
    }

    const sizes = {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 h-10 text-sm",
        lg: "px-6 py-3 text-base",
        icon: "p-2 w-9 h-9"
    }

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={props.disabled || isLoading}
            {...props}
        >
            {isLoading && <Icons.Refresh className="w-4 h-4 mr-2 animate-spin" />}
            {!isLoading && icon && <span className={children ? "mr-2" : ""}>{icon}</span>}
            {children}
        </button>
    )
}
