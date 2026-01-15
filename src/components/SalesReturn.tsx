import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Badge } from './ui/Badge'
import { Separator } from './ui/Separator'

type Sale = {
    id: string
    sales_no: string
    sales_date: string
    customer: { name: string }
    total_amount: number
}

type SaleItem = {
    id: string
    item_id: string
    item: { sku: string; name: string }
    qty: number
    unit_price: number
    uom_snapshot: string
    avg_cost_snapshot: number
}

type ReturnItem = {
    item_id: string
    sku: string
    name: string
    qty: number
    unit_price: number
    uom: string
    subtotal: number
    cost_snapshot: number
}

export default function SalesReturn() {
    const [postedSales, setPostedSales] = useState<Sale[]>([])
    const [selectedSaleId, setSelectedSaleId] = useState('')
    const [salesItems, setSalesItems] = useState<SaleItem[]>([])
    const [lines, setLines] = useState<ReturnItem[]>([])
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    // Drafts
    const [drafts, setDrafts] = useState<any[]>([])

    useEffect(() => {
        fetchPostedSales()
        fetchDraftReturns()
    }, [success])

    async function fetchPostedSales() {
        // In real app, search/pagination needed. For Phase 1, last 50?
        const { data, error } = await supabase
            .from('sales')
            .select('*, customer:customers(name)')
            .eq('status', 'POSTED')
            .order('sales_date', { ascending: false })
            .limit(50)

        if (error) setError(error.message)
        else setPostedSales(data || [])
    }

    async function fetchDraftReturns() {
        const { data } = await supabase
            .from('sales_returns')
            .select('*, sales(sales_no, customer:customers(name))')
            .eq('status', 'DRAFT')
            .order('created_at', { ascending: false })
        setDrafts(data || [])
    }

    // Load items when Sale Selected
    useEffect(() => {
        if (!selectedSaleId) {
            setSalesItems([])
            setLines([])
            return
        }
        fetchSalesItems(selectedSaleId)
    }, [selectedSaleId])

    async function fetchSalesItems(salesId: string) {
            const { data, error } = await supabase
                .from('sales_items')
                .select('*, avg_cost_snapshot, item:items(sku, name)')
                .eq('sales_id', salesId)

        if (error) setError(error.message)
        else setSalesItems(data || [])
    }

    function handleAddItem(sItem: SaleItem, returnQty: number) {
        if (returnQty <= 0) return
        if (returnQty > sItem.qty) {
            alert(`Cannot return more than sold qty (${sItem.qty})`)
            // T034
            return
        }

        const existing = lines.find(l => l.item_id === sItem.item_id)
        if (existing) {
            // Update logic if needed, or overwrite
            const newLines = lines.map(l => l.item_id === sItem.item_id ? { ...l, qty: returnQty, subtotal: returnQty * l.unit_price } : l)
            setLines(newLines)
        } else {
            setLines([...lines, {
                item_id: sItem.item_id,
                sku: sItem.item.sku,
                name: sItem.item.name,
                qty: returnQty,
                unit_price: sItem.unit_price,
                uom: sItem.uom_snapshot,
                subtotal: returnQty * sItem.unit_price,
                cost_snapshot: sItem.avg_cost_snapshot
            }])
        }
    }

    function removeLine(index: number) {
        setLines(lines.filter((_, i) => i !== index))
    }

    async function handleSaveDraft() {
        if (!selectedSaleId) return
        if (lines.length === 0) { setError("No items to return"); return }

        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            // 1. Header
            const { data: retData, error: retError } = await supabase
                .from('sales_returns')
                .insert([{
                    sales_id: selectedSaleId,
                    return_date: new Date().toISOString().split('T')[0],
                    status: 'DRAFT'
                }])
                .select()
                .single()

            if (retError) throw retError

            // 2. Items
            const itemsPayload = lines.map(l => ({
                sales_return_id: retData.id,
                item_id: l.item_id,
                uom_snapshot: l.uom,
                qty: l.qty,
                unit_price: l.unit_price,
                cost_snapshot: l.cost_snapshot,
                subtotal: l.subtotal
            }))

            const { error: linesError } = await supabase.from('sales_return_items').insert(itemsPayload)
            if (linesError) throw linesError

            setSuccess(`Return Draft Created: ${retData.id}`)
            setLines([])
            setSelectedSaleId('')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function handlePost(retId: string) {
        if (!confirm("Confirm POST Return? This handles Stock & Journals.")) return
        setLoading(true)
        try {
            const { error } = await supabase.rpc('rpc_post_sales_return', { p_return_id: retId })
            if (error) throw error
            setSuccess("Return POSTED Successfully!")
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full space-y-8">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Sales Return Processing</h2>

            {error && <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md">Error: {error}</div>}
            {success && <div className="p-4 bg-green-50 text-green-700 border border-green-200 rounded-md">Success: {success}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="shadow-md">
                        <CardHeader className="bg-blue-50/50 pb-4 border-b border-blue-100">
                            <CardTitle className="text-blue-900">1. Select Original Sales Invoice</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <Select
                                label="Sales Invoice"
                                value={selectedSaleId}
                                onChange={e => setSelectedSaleId(e.target.value)}
                                options={[
                                    { label: "-- Select Invoice --", value: "" },
                                    ...postedSales.map(s => ({
                                        label: `${s.sales_date} | ${s.sales_no || 'No Ref'} | ${s.customer.name} | ${s.total_amount.toLocaleString()}`,
                                        value: s.id
                                    }))
                                ]}
                            />
                        </CardContent>
                    </Card>

                    {selectedSaleId && (
                        <Card className="shadow-md">
                            <CardHeader className="pb-4 border-b border-gray-100">
                                <CardTitle>2. Select Items to Return</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Available Sales Items (Max Return Qty)</h4>
                                    <div className="rounded-md border border-gray-200 overflow-hidden">
                                        <Table>
                                            <TableHead className="bg-gray-50">
                                                <TableRow>
                                                    <TableHeader>SKU</TableHeader>
                                                    <TableHeader>Purchased Qty</TableHeader>
                                                    <TableHeader>Price</TableHeader>
                                                    <TableHeader>Return Qty</TableHeader>
                                                    <TableHeader>Action</TableHeader>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {salesItems.map(si => (
                                                    <TableRow key={si.id}>
                                                        <TableCell>{si.item.sku}</TableCell>
                                                        <TableCell>{si.qty}</TableCell>
                                                        <TableCell>{si.unit_price}</TableCell>
                                                        <TableCell>
                                                            <Input
                                                                id={`qty-${si.id}`}
                                                                type="number"
                                                                defaultValue={0}
                                                                min={0}
                                                                max={si.qty}
                                                                className="w-24 h-8"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button size="sm" variant="outline" onClick={() => {
                                                                const val = parseFloat((document.getElementById(`qty-${si.id}`) as HTMLInputElement).value)
                                                                handleAddItem(si, val)
                                                            }}>Add to Return</Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                                <Separator />

                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Return Manifest (Draft Preview)</h4>
                                    <div className="rounded-md border border-gray-200 overflow-hidden">
                                        <Table>
                                            <TableHead className="bg-gray-50">
                                                <TableRow>
                                                    <TableHeader>SKU</TableHeader>
                                                    <TableHeader>Qty</TableHeader>
                                                    <TableHeader>Subtotal</TableHeader>
                                                    <TableHeader>Action</TableHeader>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {lines.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center italic text-gray-500 py-4">No items added yet</TableCell></TableRow> : lines.map((l, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell>{l.sku}</TableCell>
                                                        <TableCell>{l.qty}</TableCell>
                                                        <TableCell>{l.subtotal.toLocaleString()}</TableCell>
                                                        <TableCell><Button variant="danger" size="sm" onClick={() => removeLine(i)}>Remove</Button></TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <Button onClick={handleSaveDraft} disabled={loading} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700">
                                            {loading ? 'Saving...' : 'Save Return Draft'}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="lg:col-span-1">
                    <Card className="sticky top-6">
                        <CardHeader className="bg-yellow-50/50 border-b border-yellow-100">
                            <CardTitle className="text-yellow-800">Pending Drafts</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {drafts.length === 0 ? (
                                <div className="p-6 text-center text-gray-500 italic">No pending drafts</div>
                            ) : (
                                <ul className="divide-y divide-gray-100">
                                    {drafts.map(d => (
                                        <li key={d.id} className="p-4 hover:bg-gray-50 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <Badge variant="warning" className="mb-1">DRAFT</Badge>
                                                    <div className="text-sm font-medium text-gray-900">{d.sales?.customer?.name}</div>
                                                    <div className="text-xs text-gray-500">Ref: {d.sales?.sales_no}</div>
                                                    <div className="text-xs text-gray-400">{d.return_date}</div>
                                                </div>
                                            </div>
                                            <Button size="sm" variant="primary" className="w-full mt-2" onClick={() => handlePost(d.id)} disabled={loading}>
                                                🚀 Post Return
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
