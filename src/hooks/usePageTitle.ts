import { useLocation } from 'react-router-dom'

export function usePageTitle() {
    const location = useLocation()
    const path = location.pathname

    const titles: Record<string, string> = {
        '/': 'Dashboard',
        '/sales': 'Sales',
        '/sales/history': 'Sales History',
        '/sales-return': 'Sales Return',
        '/sales-returns/history': 'Return History',
        '/purchases': 'Purchases',
        '/purchases/history': 'Purchase History',
        '/purchase-return': 'Purchase Return',
        '/purchase-returns/history': 'Return History',
        '/finance': 'Finance',
        '/journals': 'Journals',
        '/reports': 'Reporting',
        '/reporting': 'Reporting',
        '/period-lock': 'Period Lock',
        '/period-reports': 'Period Reports',
        '/inventory': 'Inventory',
        '/stock-adj': 'Stock Adjustment',
        '/stock-adjustment': 'Stock Adjustment',
        '/opening-stock': 'Opening Stock',
        '/stock-card': 'Stock Card',
        '/items': 'Items',
        '/products': 'Products',
        '/attributes': 'Attributes',
        '/brands-categories': 'Brands & Categories',
        '/customers': 'Customers',
        '/vendors': 'Vendors',
        '/coa': 'Chart of Accounts',
        '/opening-balance': 'Opening Balance',
        '/settings': 'Settings',
        '/dev-reset': 'Reset Data'
    }

    // Check exact match first
    if (titles[path]) {
        return titles[path]
    }

    // Handle dynamic routes
    if (path.startsWith('/sales/') && path.endsWith('/edit')) {
        return 'Edit Sales'
    }
    if (path.startsWith('/sales/') && !path.includes('/edit') && !path.includes('/history')) {
        return 'Sales Detail'
    }
    if (path.startsWith('/purchases/') && path.endsWith('/edit')) {
        return 'Edit Purchase'
    }
    if (path.startsWith('/purchases/') && !path.includes('/edit') && !path.includes('/history')) {
        return 'Purchase Detail'
    }
    if (path.startsWith('/sales-returns/')) {
        return 'Return Detail'
    }
    if (path.startsWith('/purchase-returns/')) {
        return 'Return Detail'
    }

    // Default fallback
    return 'Ziyada ERP'
}
