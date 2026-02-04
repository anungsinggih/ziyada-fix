import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { ButtonSelect } from './ui/ButtonSelect'
import { Textarea } from './ui/Textarea'
import { Badge } from './ui/Badge'
import { Icons } from './ui/Icons'
import { formatCurrency } from '../lib/format'
import { TotalFooter } from './ui/TotalFooter'

type Vendor = { id: string; name: string }
type Item = { id: string; name: string; sku: string; uom: string; default_price_buy: number }
type PurchaseLine = {
    item_id: string
    item_name: string
    sku: string
    uom: string
    qty: number
    unit_cost: number
    subtotal: number
}

export default function PurchaseEdit() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [vendors, setVendors] = useState<Vendor[]>([])
    const [items, setItems] = useState<Item[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [vendorId, setVendorId] = useState('')
    const [purchaseDate, setPurchaseDate] = useState('')
    const [terms, setTerms] = useState<'CASH' | 'CREDIT'>('CASH')
    const [paymentMethods, setPaymentMethods] = useState<{ code: string; name: string }[]>([])
    const [paymentMethodCode, setPaymentMethodCode] = useState('CASH')
    const [notes, setNotes] = useState('')
    const [discountAmount, setDiscountAmount] = useState(0)
    const [status, setStatus] = useState<'DRAFT' | 'POSTED' | 'VOID'>('DRAFT')

    const [lines, setLines] = useState<PurchaseLine[]>([])
    const [selectedItemId, setSelectedItemId] = useState('')
    const [qty, setQty] = useState(1)
    const [costPrice, setCostPrice] = useState(0)

    useEffect(() => {
        fetchMasterData()
        if (id) {
            fetchPurchaseData(id)
        }
    }, [id])

    const parseQtyValue = (value: string) => {
        const parsed = parseInt(value, 10)
        if (isNaN(parsed)) return 1
        return Math.max(1, parsed)
    }

    const parseCostValue = (value: string) => {
        const parsed = parseFloat(value)
        if (isNaN(parsed)) return 0
        return Math.max(0, parsed)
    }

    async function fetchMasterData() {
        try {
            const { data: venData, error: venError } = await supabase
                .from('vendors')
                .select('id, name')
                .eq('is_active', true)

            if (venError) throw venError

            const { data: itemData, error: itemError } = await supabase
                .from('items')
                .select('id, name, sku, uom, default_price_buy')
                .eq('is_active', true)

            if (itemError) throw itemError

            const { data: methodData, error: methodError } = await supabase
                .from('payment_methods')
                .select('code, name')
                .eq('is_active', true)
                .order('code', { ascending: true })

            if (methodError) throw methodError

            setVendors(venData || [])
            setItems(itemData || [])
            setPaymentMethods(methodData || [])
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message)
            else setError('Unknown error')
        }
    }

    async function fetchPurchaseData(purchaseId: string) {
        setLoading(true)
        setError(null)

        try {
            const { data: purchaseData, error: purchaseError } = await supabase
                .from('purchases')
                .select('*')
                .eq('id', purchaseId)
                .single()

            if (purchaseError) throw purchaseError

            if (purchaseData.status !== 'DRAFT') {
                setError('Cannot edit POSTED or VOID purchases. This document is immutable.')
                setStatus(purchaseData.status)
                setLoading(false)
                return
            }

            setVendorId(purchaseData.vendor_id)
            setPurchaseDate(purchaseData.purchase_date)
            setTerms(purchaseData.terms)
            setPaymentMethodCode(purchaseData.payment_method_code || 'CASH')
            setNotes(purchaseData.notes || '')
            setDiscountAmount(Number(purchaseData.discount_amount) || 0)
            setStatus(purchaseData.status)

            const { data: itemsData, error: itemsError } = await supabase
                .from('purchase_items')
                .select(`
                    item_id,
                    qty,
                    unit_cost,
                    subtotal,
                    uom_snapshot,
                    items (
                        name,
                        sku
                    )
                `)
                .eq('purchase_id', purchaseId)

            if (itemsError) throw itemsError

            const loadedLines: PurchaseLine[] = itemsData?.map(item => {
                const iData = Array.isArray(item.items) ? item.items[0] : item.items
                return {
                    item_id: item.item_id,
                    item_name: iData?.name || 'Unknown',
                    sku: iData?.sku || '',
                    uom: item.uom_snapshot,
                    qty: item.qty,
                    unit_cost: item.unit_cost,
                    subtotal: item.subtotal
                }
            }) || []

            setLines(loadedLines)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to load purchase'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    function addItem() {
        if (!selectedItemId) return
        const item = items.find(i => i.id === selectedItemId)
        if (!item) return
        if (costPrice < 0) {
            alert('Cost must be >= 0')
            return
        }

        const safeQty = Math.max(1, qty)
        const safeCost = Math.max(0, costPrice)

        const newLine: PurchaseLine = {
            item_id: item.id,
            item_name: item.name,
            sku: item.sku,
            uom: item.uom,
            qty: safeQty,
            unit_cost: safeCost,
            subtotal: safeQty * safeCost
        }

        setLines([...lines, newLine])
        setSelectedItemId('')
        setQty(1)
        setCostPrice(0)
    }

    function removeLine(index: number) {
        setLines(lines.filter((_, i) => i !== index))
    }

    function updateLineQuantity(index: number, newQty: number) {
        const updated = [...lines]
        updated[index].qty = newQty
        updated[index].subtotal = newQty * updated[index].unit_cost
        setLines(updated)
    }

    function updateLineCost(index: number, newCost: number) {
        const updated = [...lines]
        updated[index].unit_cost = newCost
        updated[index].subtotal = updated[index].qty * newCost
        setLines(updated)
    }

    const itemsTotal = lines.reduce((sum, l) => sum + l.subtotal, 0)
    const totalAmount = itemsTotal - (discountAmount || 0)

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
        if (!vendorId) {
            setError('Please select a vendor')
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
        if (totalAmount < 0) {
            setError('Diskon terlalu besar')
            return
        }
        if (!id) {
            setError('No purchase ID provided')
            return
        }

        setSaving(true)
        setError(null)

        try {
            const { error: headerError } = await supabase
                .from('purchases')
                .update({
                    vendor_id: vendorId,
                    purchase_date: purchaseDate,
                    terms: terms,
                    notes: notes || null,
                    total_amount: totalAmount,
                    discount_amount: discountAmount || 0,
                    payment_method_code: terms === 'CASH' ? paymentMethodCode : null
                })
                .eq('id', id)
                .eq('status', 'DRAFT')

            if (headerError) throw headerError

            const { error: deleteError } = await supabase
                .from('purchase_items')
                .delete()
                .eq('purchase_id', id)

            if (deleteError) throw deleteError

            const lineData = lines.map(l => ({
                purchase_id: id,
                item_id: l.item_id,
                qty: l.qty,
                unit_cost: l.unit_cost,
                subtotal: l.subtotal,
                uom_snapshot: l.uom
            }))

            const { error: insertError } = await supabase
                .from('purchase_items')
                .insert(lineData)

            if (insertError) throw insertError

            navigate(`/purchases/${id}`)
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
                <p className="mt-2 text-gray-600">Loading purchase...</p>
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
                            This purchase has status: <Badge>{status}</Badge>
                        </p>
                        <p className="text-sm text-gray-600">
                            Only DRAFT documents can be edited. POSTED and VOID documents are immutable.
                        </p>
                        <div className="flex gap-2 mt-6">
                            <Button onClick={() => navigate('/purchases/history')} variant="outline">← Back</Button>
                            <Button onClick={() => navigate(`/purchases/${id}`)}>View Details</Button>
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
                    <h2 className="hidden md:block text-3xl font-bold tracking-tight text-gray-900">Edit Purchase (DRAFT)</h2>
                    <p className="text-sm text-gray-600 mt-1">ID: {id?.substring(0, 8)}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto">
                    <Button onClick={() => navigate('/purchases/history')} variant="outline" className="w-full sm:w-auto">Cancel</Button>
                    <Button onClick={handleSave} disabled={saving} icon={<Icons.Save className="w-4 h-4" />} className="w-full sm:w-auto">
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center gap-2">
                    <Icons.Warning className="w-5 h-5" /> {error}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Purchase Header</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select label="Vendor *" value={vendorId} onChange={(e) => setVendorId(e.target.value)} options={vendors.map(v => ({ label: v.name, value: v.id }))} />
                        <Input label="Date *" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                        <ButtonSelect
                            label="Terms *"
                            value={terms}
                            onChange={(val) => setTerms(val as 'CASH' | 'CREDIT')}
                            options={[
                                { label: 'CASH', value: 'CASH' },
                                { label: 'CREDIT', value: 'CREDIT' }
                            ]}
                        />
                        <Input
                            label="Diskon"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            placeholder="0"
                            value={discountAmount || ""}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setDiscountAmount(Number(e.target.value))}
                        />
                        {terms === 'CASH' && (
                            <ButtonSelect
                                label="Payment Method *"
                                value={paymentMethodCode}
                                onChange={(val) => setPaymentMethodCode(val)}
                                options={paymentMethods.map((m) => ({
                                    label: `${m.name} (${m.code})`,
                                    value: m.code
                                }))}
                            />
                        )}
                        <div className="flex items-end">
                            <div className="flex-1">
                                <p className="text-sm text-gray-600">Items Total</p>
                                <p className="text-lg font-semibold">{formatCurrency(itemsTotal)}</p>
                                <p className="text-sm text-gray-600 mt-2">Diskon</p>
                                <p className="text-lg font-semibold">{formatCurrency(discountAmount || 0)}</p>
                                <p className="text-sm text-gray-600 mt-2">Total</p>
                                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalAmount)}</p>
                            </div>
                        </div>
                    </div>
                    <Textarea label="Notes (Optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Add notes..." />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Line Items</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="bg-purple-50/50 p-4 rounded-lg border border-purple-100 mb-4">
                        <h4 className="font-semibold mb-3 text-sm text-purple-900 uppercase tracking-wide">
                            Add Items
                        </h4>
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end">
                            <div className="flex-grow">
                                <Select
                                    label="Product"
                                    value={selectedItemId}
                                    onChange={(e) => {
                                        const newItemId = e.target.value
                                        setSelectedItemId(newItemId)
                                        const selectedItem = items.find(i => i.id === newItemId)
                                        if (selectedItem) {
                                            setCostPrice(selectedItem.default_price_buy || 0)
                                        }
                                    }}
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
                                    step="1"
                                    value={qty}
                                    onChange={(e) => setQty(parseQtyValue(e.target.value))}
                                />
                            </div>
                            <div className="w-32">
                                <Input
                                    label="Cost Price"
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    placeholder="0"
                                    value={costPrice || ""}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => setCostPrice(parseCostValue(e.target.value))}
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
                                    <TableHead className="text-right">Cost</TableHead>
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
                                                    inputMode="numeric"
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
                                                    value={line.unit_cost}
                                                    onChange={(e) => updateLineCost(idx, parseFloat(e.target.value) || 0)}
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
                        <TotalFooter label="Items Total" amount={itemsTotal} />
                        <TotalFooter label="Diskon" amount={discountAmount || 0} />
                        <TotalFooter label="Total Amount" amount={totalAmount} amountClassName="text-purple-600" />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
