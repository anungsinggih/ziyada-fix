import React from 'react'

interface BadgeProps {
    children: React.ReactNode
    variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
    className?: string
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
    const baseStyles = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"

    const variants = {
        default: "bg-blue-100 text-blue-800",
        secondary: "bg-gray-100 text-gray-800",
        success: "bg-green-100 text-green-800",
        warning: "bg-yellow-100 text-yellow-800",
        destructive: "bg-red-100 text-red-800",
        outline: "border border-gray-300 text-gray-700"
    }

    return (
        <span className={`${baseStyles} ${variants[variant]} ${className}`}>
            {children}
        </span>
    )
}
