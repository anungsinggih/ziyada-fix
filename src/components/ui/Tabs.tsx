import React, { createContext, useContext, useState } from 'react'

interface TabsContextProps {
    activeTab: string
    setActiveTab: (id: string) => void
}

const TabsContext = createContext<TabsContextProps | undefined>(undefined)

export function Tabs({ defaultValue, children, className = '', onValueChange }: { defaultValue: string, children: React.ReactNode, className?: string, onValueChange?: (value: string) => void }) {
    const [activeTab, setActiveTabState] = useState(defaultValue)

    const setActiveTab = (val: string) => {
        setActiveTabState(val)
        if (onValueChange) onValueChange(val)
    }

    return (
        <TabsContext.Provider value={{ activeTab, setActiveTab }}>
            <div className={className}>{children}</div>
        </TabsContext.Provider>
    )
}

export function TabsList({ children, className = '' }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={`flex space-x-1 bg-gray-100 p-1 rounded-lg ${className}`}>
            {children}
        </div>
    )
}

export function TabsTrigger({ value, children, className = '' }: { value: string, children: React.ReactNode, className?: string }) {
    const context = useContext(TabsContext)
    if (!context) throw new Error("TabsTrigger must be used within Tabs")

    const isActive = context.activeTab === value

    return (
        <button
            onClick={() => context.setActiveTab(value)}
            className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                } ${className}`}
        >
            {children}
        </button>
    )
}

export function TabsContent({ value, children, className = '' }: { value: string, children: React.ReactNode, className?: string }) {
    const context = useContext(TabsContext)
    if (!context) throw new Error("TabsContent must be used within Tabs")

    if (context.activeTab !== value) return null

    return <div className={`pt-4 animate-in fade-in duration-200 ${className}`}>{children}</div>
}
