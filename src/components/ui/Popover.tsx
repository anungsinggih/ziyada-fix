import React, { useState } from 'react'

interface PopoverProps {
    trigger: React.ReactNode
    children: React.ReactNode
    className?: string
}

export function Popover({ trigger, children, className = '' }: PopoverProps) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="relative inline-block text-left">
            <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
                {trigger}
            </div>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className={`absolute z-20 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none animate-in fade-in slide-in-from-top-1 duration-200 ${className}`}>
                        <div className="p-2">
                            {children}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
