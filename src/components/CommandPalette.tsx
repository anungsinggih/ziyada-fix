import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icons } from './ui/Icons'

type CommandInfo = {
    id: string
    title: string
    url: string
    icon: React.ReactNode
    section: string
    shortcut?: string
}

const COMMANDS: CommandInfo[] = [
    // Dashboard
    { id: 'home', title: 'Dashboard', url: '/', icon: <Icons.Chart className="w-4 h-4" />, section: 'General' },

    // Sales
    { id: 'new-sale', title: 'Create New Sale', url: '/sales', icon: <Icons.Plus className="w-4 h-4" />, section: 'Sales', shortcut: 'S' },
    { id: 'sales-history', title: 'Sales History', url: '/sales/history', icon: <Icons.FileText className="w-4 h-4" />, section: 'Sales' },
    { id: 'sales-return', title: 'Sales Return', url: '/sales-return', icon: <Icons.TrendingDown className="w-4 h-4" />, section: 'Sales' },

    // Purchases
    { id: 'new-purchase', title: 'Create New Purchase', url: '/purchases', icon: <Icons.Plus className="w-4 h-4" />, section: 'Purchases', shortcut: 'P' },
    { id: 'purchase-history', title: 'Purchase History', url: '/purchases/history', icon: <Icons.FileText className="w-4 h-4" />, section: 'Purchases' },

    // Inventory
    { id: 'stock-overview', title: 'Stock Overview', url: '/inventory', icon: <Icons.Package className="w-4 h-4" />, section: 'Inventory' },
    { id: 'stock-adj', title: 'Stock Adjustment', url: '/stock-adj', icon: <Icons.Edit className="w-4 h-4" />, section: 'Inventory' },

    // Finance
    { id: 'finance', title: 'Finance (AR/AP)', url: '/finance', icon: <Icons.DollarSign className="w-4 h-4" />, section: 'Finance' },
    { id: 'journals', title: 'Web Journals', url: '/journals', icon: <Icons.FileText className="w-4 h-4" />, section: 'Finance' },
    { id: 'reports', title: 'Financial Reports', url: '/reports', icon: <Icons.Chart className="w-4 h-4" />, section: 'Finance' },
    { id: 'coa', title: 'Chart of Accounts', url: '/coa', icon: <Icons.FileText className="w-4 h-4" />, section: 'Finance' },

    // Master Data
    { id: 'products', title: 'Products', url: '/products', icon: <Icons.Package className="w-4 h-4" />, section: 'Master Data' },
    { id: 'customers', title: 'Customers', url: '/customers', icon: <Icons.Users className="w-4 h-4" />, section: 'Master Data' },
    { id: 'vendors', title: 'Vendors', url: '/vendors', icon: <Icons.Users className="w-4 h-4" />, section: 'Master Data' },

    // System
    { id: 'settings', title: 'Settings', url: '/settings', icon: <Icons.Settings className="w-4 h-4" />, section: 'System' },
]

export function CommandPalette() {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const navigate = useNavigate()

    const filteredCommands = useMemo(() => {
        if (!search) return COMMANDS
        return COMMANDS.filter(c =>
            c.title.toLowerCase().includes(search.toLowerCase()) ||
            c.section.toLowerCase().includes(search.toLowerCase())
        )
    }, [search])

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
                setSearch('')
                setSelectedIndex(0)
            }
            if (e.key === 'Escape') {
                setOpen(false)
            }
        }
        document.addEventListener('keydown', down)
        return () => document.removeEventListener('keydown', down)
    }, [])

    const handleSelect = (command: CommandInfo) => {
        setOpen(false)
        navigate(command.url)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1))
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex(i => Math.max(i - 1, 0))
        }
        if (e.key === 'Enter') {
            e.preventDefault()
            if (filteredCommands[selectedIndex]) {
                handleSelect(filteredCommands[selectedIndex])
            }
        }
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={() => setOpen(false)}
            />

            {/* Palette */}
            <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col max-h-[60vh] animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center px-4 py-3 border-b border-gray-100">
                    <Icons.Search className="w-5 h-5 text-gray-400 mr-3" />
                    <input
                        autoFocus
                        type="text"
                        placeholder="Type a command or search..."
                        className="flex-1 bg-transparent outline-none text-gray-800 placeholder:text-gray-400 text-lg"
                        value={search}
                        onChange={e => {
                            setSearch(e.target.value)
                            setSelectedIndex(0)
                        }}
                        onKeyDown={handleKeyDown}
                    />
                    <div className="flex items-center gap-1">
                        <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 rounded">ESC</kbd>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
                    {!filteredCommands.length && (
                        <div className="py-12 text-center text-gray-500 text-sm">
                            No results found.
                        </div>
                    )}

                    {/* Group by Section if needed, but flat list is fine for mvp */}
                    <div className="space-y-1">
                        {filteredCommands.map((command, index) => (
                            <button
                                key={command.id}
                                onClick={() => handleSelect(command)}
                                className={`
                                    w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-colors
                                    ${index === selectedIndex
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-700 hover:bg-gray-50'
                                    }
                                `}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-1 rounded ${index === selectedIndex ? 'text-blue-600' : 'text-gray-400'}`}>
                                        {command.icon}
                                    </div>
                                    <div>
                                        <span className="font-medium">{command.title}</span>
                                        <span className="ml-2 text-xs text-gray-400 font-normal">{command.section}</span>
                                    </div>
                                </div>
                                {command.shortcut && (index === selectedIndex) && (
                                    <span className="text-xs font-semibold opacity-60">Go</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
                    <span>
                        <span className="font-semibold text-gray-500">↑↓</span> to navigate
                        <span className="mx-2">·</span>
                        <span className="font-semibold text-gray-500">↵</span> to select
                    </span>
                    <span>Ziyada ERP</span>
                </div>
            </div>
        </div>
    )
}
