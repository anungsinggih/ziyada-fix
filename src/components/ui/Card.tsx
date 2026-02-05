import React from 'react'
// Simple helper if cn is not available in utils or you want to keep dependencies low
function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ')
}

type CardProps = React.HTMLAttributes<HTMLDivElement>

export function Card({ className, ...props }: CardProps) {
    return (
        <div
            className={classNames(
                "bg-[var(--bg-surface)] rounded-xl border border-[var(--border-light)] shadow-sm hover:shadow-soft transition-all duration-300 print:shadow-none print:border-0",
                className || ""
            )}
            {...props}
        />
    )
}

export function CardHeader({ className, ...props }: CardProps) {
    return <div className={classNames("p-6 pb-4 border-b border-[var(--border-light)]", className || "")} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return <h3 className={classNames("text-lg font-semibold text-[var(--text-main)] tracking-tight", className || "")} {...props} />
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
    return <p className={classNames("text-sm text-[var(--text-muted)] mt-1", className || "")} {...props} />
}

export function CardContent({ className, ...props }: CardProps) {
    return <div className={classNames("p-6 pt-4", className || "")} {...props} />
}

export function CardFooter({ className, ...props }: CardProps) {
    return <div className={classNames("p-4 bg-[var(--bg-surface-alt)] border-t border-[var(--border-light)] flex items-center rounded-b-xl", className || "")} {...props} />
}
