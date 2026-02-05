import React from 'react'
import { Link } from 'react-router-dom'
import { Icons } from './Icons'

interface BreadcrumbItem {
    label: string
    href?: string
}

interface PageHeaderProps {
    title: string
    description?: string
    breadcrumbs?: BreadcrumbItem[]
    actions?: React.ReactNode
    className?: string
}

export function PageHeader({ title, description, breadcrumbs, actions, className = '' }: PageHeaderProps) {
    return (
        <div className={`flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8 animate-in slide-in-from-top-2 fade-in duration-500 ${className}`}>
            <div className="space-y-1.5">
                {breadcrumbs && breadcrumbs.length > 0 && (
                    <nav className="flex items-center space-x-1 text-sm text-slate-500 mb-2">
                        {breadcrumbs.map((item, index) => (
                            <React.Fragment key={index}>
                                {index > 0 && <Icons.ChevronRight className="w-3 h-3 mx-1 text-slate-400" />}
                                {item.href ? (
                                    <Link to={item.href} className="hover:text-indigo-600 transition-colors">
                                        {item.label}
                                    </Link>
                                ) : (
                                    <span className="text-slate-900 font-medium">{item.label}</span>
                                )}
                            </React.Fragment>
                        ))}
                    </nav>
                )}
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {title}
                </h1>
                {description && (
                    <p className="text-slate-500 text-sm md:text-base max-w-2xl">
                        {description}
                    </p>
                )}
            </div>
            {actions && (
                <div className="flex items-center gap-3 shrink-0">
                    {actions}
                </div>
            )}
        </div>
    )
}
