

export function Loader({ className = "w-6 h-6", text }: { className?: string, text?: string }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 p-4">
            <div className={`relative flex items-center justify-center ${className}`}>
                <div className="absolute inset-0 rounded-full border-2 border-indigo-100"></div>
                <div className="absolute inset-0 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div>
            </div>
            {text && <p className="text-sm font-medium text-slate-500 animate-pulse">{text}</p>}
        </div>
    )
}

export function PageLoader() {
    return (
        <div className="flex min-h-[50vh] w-full items-center justify-center">
            <Loader className="w-10 h-10" text="Loading..." />
        </div>
    )
}
