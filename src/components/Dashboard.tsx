import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Icons } from './ui/Icons'
import { Badge } from './ui/Badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'

type DashboardMetrics = {
    sales_today: number
    sales_month: number
    sales_count_today: number
    purchases_month: number
    purchases_count_month: number
    low_stock_count: number
    total_items: number
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

    function formatCurrency(amount: number) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount)
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
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
                    <p className="text-gray-500 text-sm">Welcome back! Here's what's happening today.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => navigate('/sales')} icon={<Icons.Plus className="w-4 h-4" />}>New Sale</Button>
                    <Button onClick={() => navigate('/purchases')} variant="outline" icon={<Icons.Package className="w-4 h-4" />}>New Purchase</Button>
                </div>
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

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Sales */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg font-medium">Recent Sales</CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/sales/history')}>View All</Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeader>ID</TableHeader>
                                    <TableHeader>Customer</TableHeader>
                                    <TableHeader className="text-right">Amount</TableHeader>
                                    <TableHeader>Status</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {metrics?.recent_sales?.map((sale) => (
                                    <TableRow key={sale.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/sales/${sale.id}`)}>
                                        <TableCell className="font-mono text-xs">{sale.sales_no || sale.id.substring(0, 8)}</TableCell>
                                        <TableCell className="text-sm truncate max-w-[120px]">{sale.customer_name}</TableCell>
                                        <TableCell className="text-right font-medium text-sm">{formatCurrency(sale.total_amount)}</TableCell>
                                        <TableCell>
                                            <Badge className={sale.status === 'POSTED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                                {sale.status}
                                            </Badge>
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
                            <TableHead>
                                <TableRow>
                                    <TableHeader>ID</TableHeader>
                                    <TableHeader>Vendor</TableHeader>
                                    <TableHeader className="text-right">Amount</TableHeader>
                                    <TableHeader>Status</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {metrics?.recent_purchases?.map((purchase) => (
                                    <TableRow key={purchase.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/purchases/${purchase.id}`)}>
                                        <TableCell className="font-mono text-xs">{purchase.purchase_no || purchase.id.substring(0, 8)}</TableCell>
                                        <TableCell className="text-sm truncate max-w-[120px]">{purchase.vendor_name}</TableCell>
                                        <TableCell className="text-right font-medium text-sm">{formatCurrency(purchase.total_amount)}</TableCell>
                                        <TableCell>
                                            <Badge className={purchase.status === 'POSTED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                                {purchase.status}
                                            </Badge>
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
