import { type ReactNode } from 'react'

interface MobilePageTitleProps {
    children: ReactNode
}

export function MobilePageTitle({ children }: MobilePageTitleProps) {
    return (
        <div className="md:hidden sticky top-[44px] z-20 bg-white border-b border-gray-200 px-4 py-2 print:hidden shadow-sm">
            <h1 className="text-sm font-semibold text-gray-700 truncate">
                {children}
            </h1>
        </div>
    )
}
