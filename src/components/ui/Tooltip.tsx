import React, { useState } from 'react'

interface TooltipProps {
    content: string
    children: React.ReactNode
    className?: string
}

export function Tooltip({ content, children, className = '' }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false)

    return (
        <div className="relative inline-block">
            <div
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                className="cursor-help"
            >
                {children}
            </div>

            {isVisible && (
                <div className={`absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-sm bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 ${className}`}>
                    {content}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-gray-900" />
                </div>
            )}
        </div>
    )
}
