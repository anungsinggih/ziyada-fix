import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Textarea } from './ui/Textarea'
import { Badge } from './ui/Badge'
import { Icons } from './ui/Icons'

type Customer = { id: string; name: string; price_tier: 'UMUM' | 'KHUSUS' }
type Item = { id: string; name: string; sku: string; uom: string; price_umum: number; price_khusus: number }
type SalesLine = {
    item_id: string
    item_name: string
    sku: string
    uom: string
    qty: number
    unit_price: number
    subtotal: number
}

export default function SalesEdit() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [customers, setCustomers] = useState<Customer[]>([])
    const [items, setItems] = useState<Item[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Header State
    const [customerId, setCustomerId] = useState('')
    const [salesDate, setSalesDate] = useState('')
    const [terms, setTerms] = useState<'CASH' | 'CREDIT'>('CASH')
    const [notes, setNotes] = useState('')
    const [status, setStatus] = useState<'DRAFT' | 'POSTED' | 'VOID'>('DRAFT')

    // Lines State
    const [lines, setLines] = useState<SalesLine[]>([])

    // Line Input State
    const [selectedItemId, setSelectedItemId] = useState('')
    const [qty, setQty] = useState(1)

    useEffect(() => {
        fetchMasterData()
        if (id) {
            fetchSalesData(id)
        }
    }, [id])

    async function fetchMasterData() {
        try {
            const { data: custData, error: custError } = await supabase
                .from('customers')
                .select('id, name, price_tier')
                .eq('is_active', true)

            if (custError) throw custError

            const { data: itemData, error: itemError } = await supabase
                .from('items')
                .select('id, name, sku, uom, price_umum, price_khusus')
                .eq('is_active', true)

            if (itemError) throw itemError

            setCustomers(custData || [])
            setItems(itemData || [])
        } catch (err: any) {
            setError(err.message)
        }
    }

    async function fetchSalesData(saleId: string) {
        setLoading(true)
        setError(null)

        try {
            // Fetch header
            const { data: saleData, error: saleError } = await supabase
                .from('sales')
                .select('*')
                .eq('id', saleId)
                .single()

            if (saleError) throw saleError

            // Check if DRAFT
            if (saleData.status !== 'DRAFT') {
                setError('Cannot edit POSTED or VOID sales. This document is immutable.')
                setStatus(saleData.status)
                setLoading(false)
                return
            }

            setCustomerId(saleData.customer_id)
            setSalesDate(saleData.sales_date)
            setTerms(saleData.terms)
            setNotes(saleData.notes || '')
            setStatus(saleData.status)

            // Fetch items
            const { data: itemsData, error: itemsError } = await supabase
                .from('sales_items')
                .select(`
                    item_id,
                    qty,
                    unit_price,
                    subtotal,
                    uom_snapshot,
                    items (
                        name,
                        sku
                    )
                `)
                .eq('sales_id', saleId)

            if (itemsError) throw itemsError

            const loadedLines: SalesLine[] = itemsData?.map(item => ({
                item_id: item.item_id,
                item_name: (item.items as any)?.name || 'Unknown',
                sku: (item.items as any)?.sku || '',
                uom: item.uom_snapshot,
                qty: item.qty,
                unit_price: item.unit_price,
                subtotal: item.subtotal
            })) || []

            setLines(loadedLines)
        } catch (err: any) {
            setError(err.message || 'Failed to load sales')
        } finally {
            setLoading(false)
        }
    }

    function addItem() {
        if (!selectedItemId) return
        const item = items.find(i => i.id === selectedItemId)
        if (!item) return

        const customer = customers.find(c => c.id === customerId)
        let price = 0
        if (customer) {
            price = customer.price_tier === 'KHUSUS' ? item.price_khusus : item.price_umum
        } else {
            price = item.price_umum
        }

        const newLine: SalesLine = {
            item_id: item.id,
            item_name: item.name,
            sku: item.sku,
            uom: item.uom,
            qty: qty,
            unit_price: price,
            subtotal: qty * price
        }

        setLines([...lines, newLine])
        setSelectedItemId('')
        setQty(1)
    }

    function removeLine(index: number) {
        setLines(lines.filter((_, i) => i !== index))
    }

    function updateLineQuantity(index: number, newQty: number) {
        const updated = [...lines]
        updated[index].qty = newQty
        updated[index].subtotal = newQty * updated[index].unit_price
        setLines(updated)
    }

    function updateLinePrice(index: number, newPrice: number) {
        const updated = [...lines]
        updated[index].unit_price = newPrice
        updated[index].subtotal = updated[index].qty * newPrice
        setLines(updated)
    }

    const totalAmount = lines.reduce((sum, l) => sum + l.subtotal, 0)

    async function handleSave() {
        if (!customerId) {
            setError('Please select a customer')
            return
        }
        if (lines.length === 0) {
            setError('Please add at least one item')
            return
        }
        if (!id) {
            setError('No sales ID provided')
            return
        }

        setSaving(true)
        setError(null)

        try {
            // Update header (with DRAFT status check)
            const { error: headerError } = await supabase
                .from('sales')
                .update({
                    customer_id: customerId,
                    sales_date: salesDate,
                    terms: terms,
                    notes: notes || null,
                    total_amount: totalAmount
                })
                .eq('id', id)
                .eq('status', 'DRAFT') // Extra safety

            if (headerError) throw headerError

            // Delete existing items
            const { error: deleteError } = await supabase
                .from('sales_items')
                .delete()
                .eq('sales_id', id)

            if (deleteError) throw deleteError

            // Insert new items
            const lineData = lines.map(l => ({
                sales_id: id,
                item_id: l.item_id,
                qty: l.qty,
                unit_price: l.unit_price,
                subtotal: l.subtotal,
                uom_snapshot: l.uom
            }))

            const { error: insertError } = await supabase
                .from('sales_items')
                .insert(lineData)

            if (insertError) throw insertError

            // Success - redirect to detail
            navigate(`/sales/${id}`)
        } catch (err: any) {
            if (err.message?.includes('immutable')) {
                setError('Cannot save: Document is POSTED and immutable')
            } else {
                setError(err.message || 'Failed to save')
            }
        } finally {
            setSaving(false)
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
            <div className="w-full p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <p className="mt-2 text-gray-600">Loading sales...</p>
            </div>
        )
    }

    if (status !== 'DRAFT') {
        return (
            <div className="w-full p-8">
                <Card className="border-red-500">
                    <CardHeader className="bg-red-50">
                        <CardTitle className="text-red-800 flex items-center gap-2"><Icons.Warning className="w-5 h-5" /> Cannot Edit</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <p className="mb-4">
                            This sales document has status: <Badge>{status}</Badge>
                        </p>
                        <p className="text-sm text-gray-600">
                            Only DRAFT documents can be edited. POSTED and VOID documents are immutable.
                        </p>
                        <div className="flex gap-2 mt-6">
                            <Button onClick={() => navigate('/sales/history')} variant="outline">
                                ← Back to List
                            </Button>
                            <Button onClick={() => navigate(`/sales/${id}`)}>
                                View Details
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="w-full space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900">Edit Sales (DRAFT)</h2>
                    <p className="text-sm text-gray-600 mt-1">ID: {id?.substring(0, 8)}</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => navigate('/sales/history')} variant="outline">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving} icon={<Icons.Save className="w-4 h-4" />}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center gap-2">
                    <Icons.Warning className="w-5 h-5 flex-shrink-0" /> {error}
                </div>
            )}

            {/* Header Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Sales Header</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                            label="Customer *"
                            value={customerId}
                            onChange={(e) => setCustomerId(e.target.value)}
                            options={customers.map(c => ({ label: c.name, value: c.id }))}
                        />
                        <Input
                            label="Sales Date *"
                            type="date"
                            value={salesDate}
                            onChange={(e) => setSalesDate(e.target.value)}
                        />
                        <Select
                            label="Terms *"
                            value={terms}
                            onChange={(e) => setTerms(e.target.value as 'CASH' | 'CREDIT')}
                            options={[
                                { label: 'CASH', value: 'CASH' },
                                { label: 'CREDIT', value: 'CREDIT' }
                            ]}
                        />
                        <div className="flex items-end">
                            <div className="flex-1">
                                <p className="text-sm text-gray-600">Total</p>
                                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalAmount)}</p>
                            </div>
                        </div>
                    </div>
                    <Textarea
                        label="Notes (Optional)"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        placeholder="Add notes..."
                    />
                </CardContent>
            </Card>

            {/* Items Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Line Items</CardTitle>
                </CardHeader>
                <CardContent>
                    {lines.length === 0 ? (
                        <div className="py-8 text-center text-gray-500">
                            <p>No items added yet</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeader>SKU</TableHeader>
                                    <TableHeader>Item</TableHeader>
                                    <TableHeader>UoM</TableHeader>
                                    <TableHeader>Qty</TableHeader>
                                    <TableHeader>Price</TableHeader>
                                    <TableHeader>Subtotal</TableHeader>
                                    <TableHeader>Actions</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {lines.map((line, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="font-mono text-sm">{line.sku}</TableCell>
                                        <TableCell>{line.item_name}</TableCell>
                                        <TableCell>{line.uom}</TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                value={line.qty}
                                                onChange={(e) => updateLineQuantity(idx, parseFloat(e.target.value) || 0)}
                                                min="0.001"
                                                step="1"
                                                className="w-20"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                value={line.unit_price}
                                                onChange={(e) => updateLinePrice(idx, parseFloat(e.target.value) || 0)}
                                                min="0"
                                                step="1000"
                                                className="w-28"
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">{formatCurrency(line.subtotal)}</TableCell>
                                        <TableCell>
                                            <Button size="sm" variant="danger" onClick={() => removeLine(idx)} icon={<Icons.Trash className="w-4 h-4" />} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
                <CardFooter className="bg-gray-50 border-t">
                    <div className="flex gap-4 items-end w-full">
                        <Select
                            label="Add Item"
                            value={selectedItemId}
                            onChange={(e) => setSelectedItemId(e.target.value)}
                            options={items.map(i => ({ label: `${i.sku} - ${i.name}`, value: i.id }))}
                            className="flex-1"
                        />
                        <Input
                            label="Qty"
                            type="number"
                            value={qty}
                            onChange={(e) => setQty(parseFloat(e.target.value) || 1)}
                            min="1"
                            step="1"
                            className="w-24"
                        />
                        <Button onClick={addItem} disabled={!selectedItemId} icon={<Icons.Plus className="w-4 h-4" />}>Add</Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    )
}
