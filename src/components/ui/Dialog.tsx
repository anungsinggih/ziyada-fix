import React, { useEffect } from 'react'

interface DialogProps {
    isOpen: boolean
    onClose: () => void
    children: React.ReactNode
    contentClassName?: string
}

export function Dialog({ isOpen, onClose, children, contentClassName = '' }: DialogProps) {
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden'
        else document.body.style.overflow = 'unset'
        return () => { document.body.style.overflow = 'unset' }
    }, [isOpen])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />
            {/* Content */}
            <div className={`relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[var(--border-light)] animate-in zoom-in-95 fade-in slide-in-from-bottom-2 duration-300 overflow-hidden ring-1 ring-black/5 ${contentClassName}`}>
                {children}
            </div>
        </div>
    )
}

export function DialogHeader({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    return <div className={`px-6 py-5 border-b border-sidebar-border/10 ${className}`}>{children}</div>
}

export function DialogTitle({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    return <h3 className={`text-lg font-bold text-gray-900 leading-6 ${className}`}>{children}</h3>
}

export function DialogContent({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    return <div className={`p-6 ${className}`}>{children}</div>
}

export function DialogFooter({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    return <div className={`px-6 py-4 bg-gray-50 border-t border-gray-100 flexitems-center justify-end space-x-3 rounded-b-2xl ${className}`}>{children}</div>
}
