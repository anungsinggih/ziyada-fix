import React, { useEffect } from 'react'

interface DialogProps {
    isOpen: boolean
    onClose: () => void
    children: React.ReactNode
}

export function Dialog({ isOpen, onClose, children }: DialogProps) {
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden'
        else document.body.style.overflow = 'unset'
        return () => { document.body.style.overflow = 'unset' }
    }, [isOpen])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />
            {/* Content */}
            <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl animate-in zoom-in-95 fade-in duration-300 overflow-hidden">
                {children}
            </div>
        </div>
    )
}

export function DialogHeader({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    return <div className={`p-6 border-b border-gray-100 ${className}`}>{children}</div>
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
    return <h3 className="text-xl font-bold text-gray-900">{children}</h3>
}

export function DialogContent({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    return <div className={`p-6 ${className}`}>{children}</div>
}

export function DialogFooter({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    return <div className={`p-6 border-t border-gray-100 bg-gray-50 flex justify-end space-x-2 ${className}`}>{children}</div>
}
