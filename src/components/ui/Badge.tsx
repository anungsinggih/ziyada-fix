import React from 'react'

interface BadgeProps {
    children: React.ReactNode
    variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
    className?: string
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
    const baseStyles = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"

    const variants = {
        default: "border-transparent bg-indigo-100 text-indigo-700 hover:bg-indigo-200/80",
        secondary: "border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200/80",
        success: "border-transparent bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80",
        warning: "border-transparent bg-amber-50 text-amber-700 hover:bg-amber-100/80",
        destructive: "border-transparent bg-rose-50 text-rose-700 hover:bg-rose-100/80",
        outline: "text-slate-600 border-slate-200 hover:bg-slate-50"
    }

    return (
        <span className={`${baseStyles} ${variants[variant]} ${className}`}>
            {children}
        </span>
    )
}
