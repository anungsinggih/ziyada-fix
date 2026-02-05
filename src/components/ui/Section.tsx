import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './Card'

interface SectionProps {
    title?: React.ReactNode
    description?: React.ReactNode
    children: React.ReactNode
    className?: string
    action?: React.ReactNode
}

export function Section({ title, description, children, className = '', action }: SectionProps) {
    if (!title) {
        return (
            <Card className={`overflow-hidden border-slate-200/60 shadow-sm ${className}`}>
                <CardContent className="p-6">
                    {children}
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className={`overflow-hidden border-slate-200/60 shadow-sm ${className}`}>
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-lg font-semibold text-slate-900 tracking-tight">{title}</CardTitle>
                        {description && <CardDescription className="text-slate-500">{description}</CardDescription>}
                    </div>
                    {action && <div>{action}</div>}
                </div>
            </CardHeader>
            <CardContent className="p-6">
                {children}
            </CardContent>
        </Card>
    )
}
