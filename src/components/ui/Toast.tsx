import React, { useState, createContext, useContext } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
    id: string
    message: string
    type: ToastType
}

interface ToastContextProps {
    toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const addToast = (message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substring(2, 9)
        setToasts((prev) => [...prev, { id, message, type }])
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id))
        }, 3000)
    }

    return (
        <ToastContext.Provider value={{ toast: addToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[9999] flex flex-col space-y-2">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`px-4 py-3 rounded-lg shadow-xl text-white font-medium flex items-center space-x-2 animate-in slide-in-from-right duration-300 ${t.type === 'success' ? 'bg-green-600' :
                            t.type === 'error' ? 'bg-red-600' :
                                'bg-gray-800'
                            }`}
                    >
                        <span>{t.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) throw new Error("useToast must be used within ToastProvider")
    return context
}
