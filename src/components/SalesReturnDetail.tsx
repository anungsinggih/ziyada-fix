import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import { Icons } from './ui/Icons'

type SalesReturnDetail = {
    id: string
    return_date: string
    sales_id: string
    sales_no: string | null
    customer_name: string
    total_amount: number
    status: 'DRAFT' | 'POSTED' | 'VOID'
    notes: string | null
    created_at: string
}

type ReturnItem = {
    id: string
    item_id: string
    item_name: string
    sku: string
    uom_snapshot: string
    qty: number
    unit_price: number
    subtotal: number
    cost_snapshot: number
}

export default function SalesReturnDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [returnDoc, setReturnDoc] = useState<SalesReturnDetail | null>(null)
    const [items, setItems] = useState<ReturnItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (id) {
            fetchReturnDetail(id)
        }
    }, [id])

    async function fetchReturnDetail(returnId: string) {
        setLoading(true)
        setError(null)

        try {
            // Fetch header
            const { data: returnData, error: returnError } = await supabase
                .from('sales_returns')
                .select(`
                    id,
                    return_date,
                    sales_id,
                    total_amount,
                    status,
                    notes,
                    created_at,
                    sales!sales_id (
                        sales_no,
                        customers (
                            name
                        )
                    )
                `)
                .eq('id', returnId)
                .single()

            if (returnError) throw returnError

            setReturnDoc({
                ...returnData,
                sales_no: (returnData.sales as unknown as { sales_no: string })?.sales_no || 'N/A',
                customer_name: (returnData.sales as unknown as { customers: { name: string } })?.customers?.name || 'Unknown'
            })

            // Fetch items
            const { data: itemsData, error: itemsError } = await supabase
                .from('sales_return_items')
                .select(`
                    id,
                    item_id,
                    qty,
                    unit_price,
                    cost_snapshot,
                    subtotal,
                    uom_snapshot,
                    items (
                        name,
                        sku
                    )
                `)
                .eq('return_id', returnId)

            if (itemsError) throw itemsError

            setItems(itemsData?.map(item => ({
                ...item,
                item_name: (item.items as unknown as { name: string })?.name || 'Unknown',
                sku: (item.items as unknown as { sku: string })?.sku || ''
            })) || [])
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message || 'Failed to fetch return detail')
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

    function getStatusBadge(status: string) {
        const colors = {
            'DRAFT': 'bg-gray-100 text-gray-800',
            'POSTED': 'bg-green-100 text-green-800',
            'VOID': 'bg-red-100 text-red-800'
        }
        return (
            <Badge className={colors[status as keyof typeof colors] || 'bg-gray-100'}>
                {status}
            </Badge>
        )
    }

    if (loading) {
        return (
            <div className="w-full p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <p className="mt-2 text-gray-600">Loading return detail...</p>
            </div>
        )
    }

    if (error || !returnDoc) {
        return (
            <div className="w-full p-8">
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center gap-2">
                    <Icons.Warning className="w-5 h-5 flex-shrink-0" /> {error || 'Return not found'}
                </div>
                <Button onClick={() => navigate('/sales-returns/history')} className="mt-4">
                    ← Back to List
                </Button>
            </div>
        )
    }

    return (
        <div className="w-full space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight text-gray-900">Sales Return Detail</h2>
                <Button onClick={() => navigate('/sales-returns/history')} variant="outline">
                    ← Back to List
                </Button>
            </div>

            {/* Header Card */}
            <Card>
                <CardHeader className="bg-gray-50">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Return Document</CardTitle>
                            <p className="text-sm text-gray-600 mt-1">
                                ID: {returnDoc.id.substring(0, 8)}
                            </p>
                        </div>
                        {getStatusBadge(returnDoc.status)}
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-gray-600">Return Date</p>
                            <p className="font-medium">{new Date(returnDoc.return_date).toLocaleDateString('id-ID')}</p>
                        </div>
                        <div>
                            <p className="text-gray-600">Original Sales</p>
                            <p className="font-mono text-sm">{returnDoc.sales_no}</p>
                        </div>
                        <div>
                            <p className="text-gray-600">Customer</p>
                            <p className="font-medium">{returnDoc.customer_name}</p>
                        </div>
                        <div>
                            <p className="text-gray-600">Total</p>
                            <p className="font-bold text-lg">{formatCurrency(returnDoc.total_amount)}</p>
                        </div>
                    </div>
                    {returnDoc.notes && (
                        <div className="mt-4 pt-4 border-t">
                            <p className="text-gray-600 text-sm">Notes</p>
                            <p className="text-sm mt-1">{returnDoc.notes}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Items Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Return Line Items</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeader>SKU</TableHeader>
                                    <TableHeader>Item Name</TableHeader>
                                    <TableHeader>UoM</TableHeader>
                                    <TableHeader className="text-right">Qty</TableHeader>
                                    <TableHeader className="text-right">Avg Cost</TableHeader>
                                    <TableHeader className="text-right">Unit Price</TableHeader>
                                    <TableHeader className="text-right">Subtotal</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {items.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                                        <TableCell>{item.item_name}</TableCell>
                                        <TableCell>{item.uom_snapshot}</TableCell>
                                        <TableCell className="text-right">{item.qty}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(item.cost_snapshot)}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(item.subtotal)}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-gray-50 font-bold border-t-2">
                                    <TableCell colSpan={6} className="text-right">TOTAL:</TableCell>
                                    <TableCell className="text-right">{formatCurrency(returnDoc.total_amount)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
