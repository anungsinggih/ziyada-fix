import { usePageTitle } from '../hooks/usePageTitle'
import { Icons } from './ui/Icons'

interface MobileHeaderProps {
    mobileMenuOpen: boolean
    onToggleMenu: () => void
}

export function MobileHeader({ mobileMenuOpen, onToggleMenu }: MobileHeaderProps) {
    const pageTitle = usePageTitle()

    return (
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border-b border-slate-800 shadow-lg print:hidden">
            <div className="flex items-center justify-between px-4 py-3">
                <button
                    onClick={onToggleMenu}
                    className="p-2 text-white rounded-lg hover:bg-slate-800 transition-colors"
                    aria-label="Toggle menu"
                >
                    {mobileMenuOpen ? <Icons.Close className="w-6 h-6 text-white" /> : <Icons.Menu className="w-6 h-6 text-white" />}
                </button>
                <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="Ziyada ERP" className="h-8 w-auto rounded" />
                    <span className="text-white font-semibold text-sm">{pageTitle}</span>
                </div>
                <div className="w-10" /> {/* Spacer for centering */}
            </div>
        </div>
    )
}
