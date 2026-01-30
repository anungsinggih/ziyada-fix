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

type Vendor = { id: string; name: string }
type Item = { id: string; name: string; sku: string; uom: string }
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
    const [notes, setNotes] = useState('')
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

    async function fetchMasterData() {
        try {
            const { data: venData, error: venError } = await supabase
                .from('vendors')
                .select('id, name')
                .eq('is_active', true)

            if (venError) throw venError

            const { data: itemData, error: itemError } = await supabase
                .from('items')
                .select('id, name, sku, uom')

            if (itemError) throw itemError

            setVendors(venData || [])
            setItems(itemData || [])
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
            setNotes(purchaseData.notes || '')
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

        const newLine: PurchaseLine = {
            item_id: item.id,
            item_name: item.name,
            sku: item.sku,
            uom: item.uom,
            qty: qty,
            unit_cost: costPrice,
            subtotal: qty * costPrice
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

    const totalAmount = lines.reduce((sum, l) => sum + l.subtotal, 0)

    async function handleSave() {
        if (!vendorId) {
            setError('Please select a vendor')
            return
        }
        if (lines.length === 0) {
            setError('Please add at least one item')
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
                    total_amount: totalAmount
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
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900">Edit Purchase (DRAFT)</h2>
                    <p className="text-sm text-gray-600 mt-1">ID: {id?.substring(0, 8)}</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => navigate('/purchases/history')} variant="outline">Cancel</Button>
                    <Button onClick={handleSave} disabled={saving} icon={<Icons.Save className="w-4 h-4" />}>{saving ? 'Saving...' : 'Save'}</Button>
                </div>
            </div>

            {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center gap-2"><Icons.Warning className="w-5 h-5" /> {error}</div>}

            <Card>
                <CardHeader><CardTitle>Purchase Header</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select label="Vendor *" value={vendorId} onChange={(e) => setVendorId(e.target.value)} options={vendors.map(v => ({ label: v.name, value: v.id }))} />
                        <Input label="Date *" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                        <Select label="Terms *" value={terms} onChange={(e) => setTerms(e.target.value as 'CASH' | 'CREDIT')} options={[{ label: 'CASH', value: 'CASH' }, { label: 'CREDIT', value: 'CREDIT' }]} />
                        <div className="flex items-end"><div className="flex-1"><p className="text-sm text-gray-600">Total</p><p className="text-2xl font-bold text-green-600">{formatCurrency(totalAmount)}</p></div></div>
                    </div>
                    <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Add notes..." />
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
                <CardContent>
                    {lines.length === 0 ? (
                        <div className="py-8 text-center text-gray-500"><p>No items</p></div>
                    ) : (
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeader>SKU</TableHeader>
                                    <TableHeader>Item</TableHeader>
                                    <TableHeader>UoM</TableHeader>
                                    <TableHeader>Qty</TableHeader>
                                    <TableHeader>Cost</TableHeader>
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
                                        <TableCell><Input type="number" value={line.qty} onChange={(e) => updateLineQuantity(idx, parseFloat(e.target.value) || 0)} min="0" step="1" className="w-20" /></TableCell>
                                        <TableCell><Input type="number" value={line.unit_cost} onChange={(e) => updateLineCost(idx, parseFloat(e.target.value) || 0)} min="0" step="1000" className="w-28" /></TableCell>
                                        <TableCell className="font-medium">{formatCurrency(line.subtotal)}</TableCell>
                                        <TableCell><Button size="sm" variant="danger" onClick={() => removeLine(idx)} icon={<Icons.Trash className="w-4 h-4" />} /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
                <CardFooter className="bg-gray-50 border-t">
                    <div className="flex gap-4 items-end w-full">
                        <Select label="Add Item" value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} options={items.map(i => ({ label: `${i.sku} - ${i.name}`, value: i.id }))} className="flex-1" />
                        <Input label="Qty" type="number" value={qty} onChange={(e) => setQty(parseFloat(e.target.value) || 1)} min="1" className="w-24" />
                        <Input label="Cost" type="number" value={costPrice} onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)} min="0" className="w-32" />
                        <Button onClick={addItem} disabled={!selectedItemId} icon={<Icons.Plus className="w-4 h-4" />}>Add</Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    )
}
