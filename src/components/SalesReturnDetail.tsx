import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { getErrorMessage } from "../lib/errors";
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from './ui/Button'
import { Icons } from './ui/Icons'
import { formatCurrency, formatDate, safeDocNo } from '../lib/format'
import DocumentHeaderCard from './shared/DocumentHeaderCard'
import LineItemsTable from './shared/LineItemsTable'

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
            setError(getErrorMessage(err, 'Failed to fetch return detail'))
        } finally {
            setLoading(false)
        }
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

    const headerFields = [
        {
            label: 'Return Date',
            value: formatDate(returnDoc.return_date),
        },
        {
            label: 'Original Sales',
            value: <span className="font-mono text-sm">{safeDocNo(returnDoc.sales_no, returnDoc.sales_id)}</span>,
        },
        {
            label: 'Customer',
            value: returnDoc.customer_name,
        },
        {
            label: 'Total',
            value: <span className="font-bold text-lg">{formatCurrency(returnDoc.total_amount)}</span>,
        },
    ]

    const lineItemColumns = [
        {
            label: 'SKU',
            cellClassName: 'font-mono text-sm',
            render: (item: ReturnItem) => item.sku,
        },
        {
            label: 'Item Name',
            render: (item: ReturnItem) => item.item_name,
        },
        {
            label: 'UoM',
            render: (item: ReturnItem) => item.uom_snapshot,
        },
        {
            label: 'Qty',
            headerClassName: 'text-right',
            cellClassName: 'text-right',
            render: (item: ReturnItem) => item.qty,
        },
        {
            label: 'Avg Cost',
            headerClassName: 'text-right',
            cellClassName: 'text-right',
            render: (item: ReturnItem) => formatCurrency(item.cost_snapshot),
        },
        {
            label: 'Unit Price',
            headerClassName: 'text-right',
            cellClassName: 'text-right',
            render: (item: ReturnItem) => formatCurrency(item.unit_price),
        },
        {
            label: 'Subtotal',
            headerClassName: 'text-right',
            cellClassName: 'text-right font-medium',
            render: (item: ReturnItem) => formatCurrency(item.subtotal),
        },
    ]

    return (
        <div className="w-full space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="hidden md:block text-3xl font-bold tracking-tight text-gray-900">Sales Return</h2>
                <Button onClick={() => navigate('/sales-returns/history')} variant="outline">
                    ← Back to List
                </Button>
            </div>

            <DocumentHeaderCard
                title="Sales Return"
                docNo={safeDocNo(null, returnDoc.id, true)}
                status={returnDoc.status}
                fields={headerFields}
                notes={returnDoc.notes}
            />

            <LineItemsTable
                title="Return Items"
                rows={items}
                columns={lineItemColumns}
                totalValue={formatCurrency(returnDoc.total_amount)}
                emptyLabel="No items added"
            />
        </div>
    )
}
