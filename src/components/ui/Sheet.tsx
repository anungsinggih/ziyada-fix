import React, { useEffect } from 'react'

interface SheetProps {
    isOpen: boolean
    onClose: () => void
    side?: 'left' | 'right' | 'top' | 'bottom'
    children: React.ReactNode
    contentClassName?: string
}

export function Sheet({ isOpen, onClose, side = 'right', children, contentClassName = '' }: SheetProps) {
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden'
        else document.body.style.overflow = 'unset'
        return () => { document.body.style.overflow = 'unset' }
    }, [isOpen])

    if (!isOpen) return null

    const sideStyles = {
        right: "inset-y-0 right-0 h-full w-full max-w-sm border-l animate-in slide-in-from-right duration-300",
        left: "inset-y-0 left-0 h-full w-full max-w-sm border-r animate-in slide-in-from-left duration-300",
        top: "inset-x-0 top-0 w-full h-1/3 border-b animate-in slide-in-from-top duration-300",
        bottom: "inset-x-0 bottom-0 w-full h-1/3 border-t animate-in slide-in-from-bottom duration-300"
    }

    return (
        <div className="fixed inset-0 z-50">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />
            {/* Content */}
            <div className={`absolute bg-white shadow-2xl overflow-auto ${sideStyles[side]} ${contentClassName}`}>
                <div className="p-6 relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        ✕
                    </button>
                    {children}
                </div>
            </div>
        </div>
    )
}
