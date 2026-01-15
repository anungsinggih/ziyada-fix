interface ProgressProps {
    value: number
    max?: number
    className?: string
}

export function Progress({ value, max = 100, className = '' }: ProgressProps) {
    const percentage = Math.min(Math.max(0, (value / max) * 100), 100)

    return (
        <div className={`w-full bg-gray-200 rounded-full h-2.5 overflow-hidden ${className}`}>
            <div
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
            />
        </div>
    )
}
