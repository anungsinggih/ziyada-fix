import React, { useState } from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { Tabs, TabsList, TabsTrigger } from './Tabs'

interface ResponsiveTableProps {
    children: React.ReactNode
    minWidth?: string
    showCardToggle?: boolean
    cardView?: React.ReactNode
    className?: string
}

export function ResponsiveTable({
    children,
    minWidth = '640px',
    showCardToggle = false,
    cardView,
    className = ''
}: ResponsiveTableProps) {
    const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
    const isMobile = useMediaQuery('(max-width: 768px)')

    // Show toggle only on mobile and if cardView is provided
    const showToggle = showCardToggle && isMobile && cardView

    return (
        <div className={`w-full ${className}`}>
            {showToggle && (
                <div className="flex justify-end mb-3">
                    <Tabs
                        defaultValue="table"
                        value={viewMode}
                        onValueChange={(val) => setViewMode(val as 'table' | 'card')}
                        className="inline-block"
                    >
                        <TabsList className="grid w-full grid-cols-2 h-9">
                            <TabsTrigger value="table" className="text-xs">
                                Table
                            </TabsTrigger>
                            <TabsTrigger value="card" className="text-xs">
                                Cards
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            )}

            {viewMode === 'card' && cardView ? (
                <div className="space-y-2">{cardView}</div>
            ) : (
                <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                    <div style={{ minWidth }} className="w-full">
                        {children}
                    </div>
                </div>
            )}
        </div>
    )
}
