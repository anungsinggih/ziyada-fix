interface SeparatorProps {
    orientation?: 'horizontal' | 'vertical'
    className?: string
}

export function Separator({ orientation = 'horizontal', className = '' }: SeparatorProps) {
    const baseStyles = "bg-gray-200"
    const orientationStyles = orientation === 'horizontal' ? "h-[1px] w-full" : "h-full w-[1px]"

    return (
        <div className={`${baseStyles} ${orientationStyles} ${className}`} />
    )
}
