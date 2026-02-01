import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Icons } from './ui/Icons'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { StatusBadge } from './ui/StatusBadge'
import { formatCurrency, safeDocNo } from '../lib/format'

type DashboardMetrics = {
    sales_today: number
    sales_month: number
    sales_count_today: number
    purchases_month: number
    purchases_count_month: number
    low_stock_count: number
    total_items: number
    // Finance Health
    total_ar: number
    total_ap: number
    cash_balance: number
    top_items?: {
        item_name: string
        total_qty: number
        total_amount: number
    }[]
    // Stale Drafts
    stale_draft_sales: number
    stale_draft_purchases: number
    recent_sales: {
        id: string
        sales_no: string
        customer_name: string
        total_amount: number
        status: string
    }[]
    recent_purchases: {
        id: string
        purchase_no: string
        vendor_name: string
        total_amount: number
        status: string
    }[]
}

export default function Dashboard() {
    const navigate = useNavigate()
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchMetrics()
    }, [])

    async function fetchMetrics() {
        try {
            const { data, error } = await supabase.rpc('rpc_get_dashboard_metrics')
            if (error) throw error
            setMetrics(data)
        } catch (error) {
            console.error('Error fetching metrics:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                    <p className="text-gray-500">Loading dashboard...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="hidden md:block text-2xl font-bold text-gray-900">Dashboard Overview</h1>
                    <p className="hidden md:block text-gray-500 text-sm">Welcome back! Here's what's happening today.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => navigate('/sales')} icon={<Icons.Plus className="w-4 h-4" />}>New Sale</Button>
                    <Button onClick={() => navigate('/purchases')} variant="outline" icon={<Icons.Package className="w-4 h-4" />}>New Purchase</Button>
                </div>
            </div>

            {/* Stale Draft Alerts */}
            {((metrics?.stale_draft_sales || 0) > 0 || (metrics?.stale_draft_purchases || 0) > 0) && (
                <div className="space-y-2">
                    {(metrics?.stale_draft_sales || 0) > 0 && (
                        <div className="bg-orange-50 border border-orange-200 rounded-md p-3 flex items-start gap-3">
                            <Icons.Warning className="w-5 h-5 text-orange-600 mt-0.5" />
                            <div className="flex-1">
                                <h4 className="text-sm font-semibold text-orange-800">Review Required: {metrics?.stale_draft_sales} Pending Sales Drafts</h4>
                                <p className="text-xs text-orange-700 mt-1">There are sales drafts older than 48 hours. Please review and finalize or delete them to keep inventory accurate.</p>
                            </div>
                            <Button size="sm" variant="outline" className="bg-white border-orange-200 text-orange-700 h-8 text-xs hover:bg-orange-100" onClick={() => navigate('/sales')}>Review</Button>
                        </div>
                    )}
                    {(metrics?.stale_draft_purchases || 0) > 0 && (
                        <div className="bg-orange-50 border border-orange-200 rounded-md p-3 flex items-start gap-3">
                            <Icons.Warning className="w-5 h-5 text-orange-600 mt-0.5" />
                            <div className="flex-1">
                                <h4 className="text-sm font-semibold text-orange-800">Review Required: {metrics?.stale_draft_purchases} Pending Purchase Drafts</h4>
                                <p className="text-xs text-orange-700 mt-1">There are purchase drafts older than 48 hours. Please review and finalize or delete them.</p>
                            </div>
                            <Button size="sm" variant="outline" className="bg-white border-orange-200 text-orange-700 h-8 text-xs hover:bg-orange-100" onClick={() => navigate('/purchases')}>Review</Button>
                        </div>
                    )}
                </div>
            )}

            {/* Finance Health (Priority) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from- emerald-50 to-white border-emerald-100">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-emerald-600">Cash Balance (Est)</p>
                                <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(metrics?.cash_balance || 0)}</h3>
                                <p className="text-xs text-gray-500 mt-1">Cash on Hand</p>
                            </div>
                            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                                <Icons.DollarSign className="w-5 h-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-indigo-600">Total Receivables (AR)</p>
                                <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(metrics?.total_ar || 0)}</h3>
                                <p className="text-xs text-gray-500 mt-1">Outstanding Invoices</p>
                            </div>
                            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                <Icons.TrendingUp className="w-5 h-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-amber-600">Total Payables (AP)</p>
                                <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(metrics?.total_ap || 0)}</h3>
                                <p className="text-xs text-gray-500 mt-1">Unpaid Bills</p>
                            </div>
                            <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                                <Icons.TrendingDown className="w-5 h-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Sales Today */}
                <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-blue-600">Sales Today</p>
                                <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(metrics?.sales_today || 0)}</h3>
                                <p className="text-xs text-gray-500 mt-1">{metrics?.sales_count_today || 0} transactions</p>
                            </div>
                            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                <Icons.TrendingUp className="w-5 h-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Sales Month */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Sales This Month</p>
                                <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(metrics?.sales_month || 0)}</h3>
                            </div>
                            <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
                                <Icons.Chart className="w-5 h-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Purchases Month */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Purchases This Month</p>
                                <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(metrics?.purchases_month || 0)}</h3>
                                <p className="text-xs text-gray-500 mt-1">{metrics?.purchases_count_month || 0} transactions</p>
                            </div>
                            <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
                                <Icons.Cart className="w-5 h-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Low Stock */}
                <Card className={metrics?.low_stock_count ? "bg-red-50 border-red-100" : ""}>
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className={metrics?.low_stock_count ? "text-sm font-medium text-red-600" : "text-sm font-medium text-gray-500"}>Low Stock Items</p>
                                <h3 className="text-2xl font-bold text-gray-900 mt-1">{metrics?.low_stock_count || 0}</h3>
                                <p className="text-xs text-gray-500 mt-1">out of {metrics?.total_items || 0} items</p>
                            </div>
                            <div className={metrics?.low_stock_count ? "p-2 bg-red-100 rounded-lg text-red-600" : "p-2 bg-gray-100 rounded-lg text-gray-600"}>
                                <Icons.AlertCircle className="w-5 h-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity & Top Items */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Top Performing Items */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg font-medium text-amber-700 flex items-center gap-2">
                            <Icons.Award className="w-5 h-5" /> Top Sale Items (Month)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead className="text-right">Revenue</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {metrics?.top_items?.map((item, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-medium text-sm">{item.item_name}</TableCell>
                                        <TableCell className="text-right font-medium">{item.total_qty}</TableCell>
                                        <TableCell className="text-right text-xs text-gray-500">{formatCurrency(item.total_amount)}</TableCell>
                                    </TableRow>
                                ))}
                                {!metrics?.top_items?.length && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8 text-gray-400 italic">No sales data this month</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Recent Sales */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg font-medium">Recent Sales</CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/sales/history')}>View All</Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {metrics?.recent_sales?.map((sale) => (
                                    <TableRow key={sale.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/sales/${sale.id}`)}>
                                        <TableCell className="font-mono text-xs">{safeDocNo(sale.sales_no, sale.id)}</TableCell>
                                        <TableCell className="text-sm truncate max-w-[120px]">{sale.customer_name}</TableCell>
                                        <TableCell className="text-right font-medium text-sm">{formatCurrency(sale.total_amount)}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={sale.status} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {!metrics?.recent_sales?.length && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-4 text-gray-500">No recent sales</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Recent Purchases */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg font-medium">Recent Purchases</CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/purchases/history')}>View All</Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Vendor</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {metrics?.recent_purchases?.map((purchase) => (
                                    <TableRow key={purchase.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/purchases/${purchase.id}`)}>
                                        <TableCell className="font-mono text-xs">{safeDocNo(purchase.purchase_no, purchase.id)}</TableCell>
                                        <TableCell className="text-sm truncate max-w-[120px]">{purchase.vendor_name}</TableCell>
                                        <TableCell className="text-right font-medium text-sm">{formatCurrency(purchase.total_amount)}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={purchase.status} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {!metrics?.recent_purchases?.length && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-4 text-gray-500">No recent purchases</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
