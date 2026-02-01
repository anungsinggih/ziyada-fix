import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Textarea } from './ui/Textarea'
import { Badge } from './ui/Badge'
import { Icons } from './ui/Icons'
import { formatCurrency } from '../lib/format'
import { TotalFooter } from './ui/TotalFooter'

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
    const [paymentMethods, setPaymentMethods] = useState<{ code: string; name: string }[]>([])
    const [paymentMethodCode, setPaymentMethodCode] = useState('CASH')
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

            const { data: methodData, error: methodError } = await supabase
                .from('payment_methods')
                .select('code, name')
                .eq('is_active', true)
                .order('code', { ascending: true })

            if (methodError) throw methodError

            setCustomers(custData || [])
            setItems(itemData || [])
            setPaymentMethods(methodData || [])
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message)
            else setError('Unknown error')
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
            setPaymentMethodCode(saleData.payment_method_code || 'CASH')
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

            const loadedLines: SalesLine[] = itemsData?.map(item => {
                // Determine item name/sku from joined data (singular or array)
                const iData = Array.isArray(item.items) ? item.items[0] : item.items
                return {
                    item_id: item.item_id,
                    item_name: iData?.name || 'Unknown',
                    sku: iData?.sku || '',
                    uom: item.uom_snapshot,
                    qty: item.qty,
                    unit_price: item.unit_price,
                    subtotal: item.subtotal
                }
            }) || []

            setLines(loadedLines)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to load sales'
            setError(msg)
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

    useEffect(() => {
        if (terms === 'CREDIT') {
            setPaymentMethodCode('')
            return
        }
        if (!paymentMethodCode) {
            const hasCash = paymentMethods.some((m) => m.code === 'CASH')
            setPaymentMethodCode(hasCash ? 'CASH' : paymentMethods[0]?.code || '')
        }
    }, [terms, paymentMethods, paymentMethodCode])

    async function handleSave() {
        if (!customerId) {
            setError('Please select a customer')
            return
        }
        if (terms === 'CASH' && !paymentMethodCode) {
            setError('Please select payment method')
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
                    total_amount: totalAmount,
                    payment_method_code: terms === 'CASH' ? paymentMethodCode : null
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
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to save'
            if (msg?.includes('immutable')) {
                setError('Cannot save: Document is POSTED and immutable')
            } else {
                setError(msg)
            }
        } finally {
            setSaving(false)
        }
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="hidden md:block text-3xl font-bold tracking-tight text-gray-900">Edit Sales (DRAFT)</h2>
                    <p className="text-sm text-gray-600 mt-1">ID: {id?.substring(0, 8)}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto">
                    <Button onClick={() => navigate('/sales/history')} variant="outline" className="w-full sm:w-auto">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving} icon={<Icons.Save className="w-4 h-4" />} className="w-full sm:w-auto">
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
                        {terms === 'CASH' && (
                            <Select
                                label="Payment Method *"
                                value={paymentMethodCode}
                                onChange={(e) => setPaymentMethodCode(e.target.value)}
                                options={[
                                    { label: '-- Select Method --', value: '' },
                                    ...paymentMethods.map((m) => ({
                                        label: `${m.name} (${m.code})`,
                                        value: m.code
                                    }))
                                ]}
                            />
                        )}
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
                    <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 mb-4">
                        <h4 className="font-semibold mb-3 text-sm text-blue-900 uppercase tracking-wide">
                            Add Items
                        </h4>
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end">
                            <div className="flex-grow">
                                <Select
                                    label="Product"
                                    value={selectedItemId}
                                    onChange={(e) => setSelectedItemId(e.target.value)}
                                    options={[
                                        { label: "-- Select Item --", value: "" },
                                        ...items.map((i) => ({
                                            label: `${i.sku} - ${i.name}`,
                                            value: i.id,
                                        })),
                                    ]}
                                />
                            </div>
                            <div className="w-28">
                                <Input
                                    label="Qty"
                                    type="number"
                                    inputMode="numeric"
                                    min="1"
                                    value={qty}
                                    onChange={(e) => setQty(parseFloat(e.target.value) || 1)}
                                />
                            </div>
                            <div className="pb-1">
                                <Button
                                    type="button"
                                    onClick={addItem}
                                    className="w-full sm:w-auto min-h-[44px]"
                                    disabled={!selectedItemId}
                                >
                                    Add Item
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>SKU</TableHead>
                                    <TableHead>Item</TableHead>
                                    <TableHead>UoM</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                    <TableHead className="text-right">Subtotal</TableHead>
                                    <TableHead className="w-12">&nbsp;</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lines.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-gray-400 py-8 italic bg-gray-50/30">
                                            No items added yet
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    lines.map((line, idx) => (
                                        <TableRow key={idx} className="hover:bg-gray-50/50">
                                            <TableCell className="font-mono text-sm">{line.sku}</TableCell>
                                            <TableCell>{line.item_name}</TableCell>
                                            <TableCell>{line.uom}</TableCell>
                                            <TableCell className="text-right">
                                                <Input
                                                    type="number"
                                                    value={line.qty}
                                                    onChange={(e) => updateLineQuantity(idx, parseFloat(e.target.value) || 0)}
                                                    min="0.001"
                                                    step="1"
                                                    className="w-20 text-right"
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Input
                                                    type="number"
                                                    value={line.unit_price}
                                                    onChange={(e) => updateLinePrice(idx, parseFloat(e.target.value) || 0)}
                                                    min="0"
                                                    step="1000"
                                                    className="w-28 text-right"
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium text-right">{formatCurrency(line.subtotal)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" variant="danger" onClick={() => removeLine(idx)} icon={<Icons.Trash className="w-4 h-4" />} />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                        <TotalFooter label="Total Amount" amount={totalAmount} amountClassName="text-blue-600" />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
