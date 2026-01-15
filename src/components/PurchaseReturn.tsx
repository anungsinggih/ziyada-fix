import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Badge } from './ui/Badge'
import { Separator } from './ui/Separator'

import { Icons } from './ui/Icons'

type Purchase = {
    id: string
    purchase_no: string
    purchase_date: string
    vendor: { name: string }
    total_amount: number
}

type PurchaseItem = {
    id: string
    item_id: string
    item: { sku: string; name: string }
    qty: number
    unit_cost: number
    uom_snapshot: string
}

type ReturnItem = {
    item_id: string
    sku: string
    name: string
    qty: number
    unit_cost: number
    uom: string
    subtotal: number
}

export default function PurchaseReturn() {
    const [postedPurchases, setPostedPurchases] = useState<Purchase[]>([])
    const [selectedPurchaseId, setSelectedPurchaseId] = useState('')
    const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([])
    const [lines, setLines] = useState<ReturnItem[]>([])
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)


    // Drafts
    const [drafts, setDrafts] = useState<any[]>([])

    useEffect(() => {
        fetchPostedPurchases()
        fetchDraftReturns()
    }, [success])

    async function fetchPostedPurchases() {
        const { data, error } = await supabase
            .from('purchases')
            .select('*, vendor:vendors(name)')
            .eq('status', 'POSTED')
            .order('purchase_date', { ascending: false })
            .limit(50)

        if (error) setError(error.message)
        else setPostedPurchases(data || [])
    }

    async function fetchDraftReturns() {
        const { data } = await supabase
            .from('purchase_returns')
            .select('*, purchases(purchase_no, vendor:vendors(name))')
            .eq('status', 'DRAFT')
            .order('created_at', { ascending: false })
        setDrafts(data || [])
    }

    // Load items when Purchase Selected
    useEffect(() => {
        if (!selectedPurchaseId) {
            setPurchaseItems([])
            setLines([])
            return
        }
        fetchPurchaseItems(selectedPurchaseId)
    }, [selectedPurchaseId])

    async function fetchPurchaseItems(purchaseId: string) {
        const { data, error } = await supabase
            .from('purchase_items')
            .select('*, item:items(sku, name)')
            .eq('purchase_id', purchaseId)

        if (error) setError(error.message)
        else setPurchaseItems(data || [])
    }

    function handleAddItem(pItem: PurchaseItem, returnQty: number) {
        if (returnQty <= 0) return
        if (returnQty > pItem.qty) {
            alert(`Cannot return more than purchased qty (${pItem.qty})`)
            return
        }

        const existing = lines.find(l => l.item_id === pItem.item_id)
        if (existing) {
            const newLines = lines.map(l => l.item_id === pItem.item_id ? { ...l, qty: returnQty, subtotal: returnQty * l.unit_cost } : l)
            setLines(newLines)
        } else {
            setLines([...lines, {
                item_id: pItem.item_id,
                sku: pItem.item.sku,
                name: pItem.item.name,
                qty: returnQty,
                unit_cost: pItem.unit_cost,
                uom: pItem.uom_snapshot,
                subtotal: returnQty * pItem.unit_cost
            }])
        }
    }

    function removeLine(index: number) {
        setLines(lines.filter((_, i) => i !== index))
    }

    async function handleSaveDraft() {
        if (!selectedPurchaseId) return
        if (lines.length === 0) { setError("No items to return"); return }

        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            // 1. Header
            const { data: retData, error: retError } = await supabase
                .from('purchase_returns')
                .insert([{
                    purchase_id: selectedPurchaseId,
                    return_date: new Date().toISOString().split('T')[0],
                    status: 'DRAFT',
                    total_amount: lines.reduce((acc, l) => acc + l.subtotal, 0)
                }])
                .select()
                .single()

            if (retError) throw retError

            // 2. Items
            const itemsPayload = lines.map(l => ({
                purchase_return_id: retData.id,
                item_id: l.item_id,
                uom_snapshot: l.uom,
                qty: l.qty,
                unit_cost: l.unit_cost,
                subtotal: l.subtotal
            }))

            const { error: linesError } = await supabase.from('purchase_return_items').insert(itemsPayload)
            if (linesError) throw linesError

            setSuccess(`Return Draft Created: ${retData.id}`)
            setLines([])
            setSelectedPurchaseId('')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function handlePost(retId: string) {
        if (!confirm("Confirm POST Return? This handles Stock & AP.")) return
        setLoading(true)
        setError(null)
        try {
            const { error } = await supabase.rpc('rpc_post_purchase_return', { p_return_id: retId })
            if (error) throw error
            setSuccess("Return POSTED Successfully!")
            fetchDraftReturns()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full space-y-8">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Purchase Return Processing</h2>

            {error && <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center gap-2"><Icons.Warning className="w-5 h-5" /> {error}</div>}
            {success && <div className="p-4 bg-green-50 text-green-700 border border-green-200 rounded-md flex items-center gap-2"><Icons.Check className="w-5 h-5" /> {success}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="shadow-md">
                        <CardHeader className="bg-blue-50/50 pb-4 border-b border-blue-100">
                            <CardTitle className="text-blue-900">1. Select Original Purchase Order</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <Select
                                label="Purchase Order"
                                value={selectedPurchaseId}
                                onChange={e => setSelectedPurchaseId(e.target.value)}
                                options={[
                                    { label: "-- Select Purchase --", value: "" },
                                    ...postedPurchases.map(p => ({
                                        label: `${p.purchase_date} | ${p.purchase_no || 'No Ref'} | ${p.vendor.name} | ${p.total_amount.toLocaleString()}`,
                                        value: p.id
                                    }))
                                ]}
                            />
                        </CardContent>
                    </Card>

                    {selectedPurchaseId && (
                        <Card className="shadow-md">
                            <CardHeader className="pb-4 border-b border-gray-100">
                                <CardTitle>2. Select Items to Return</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Available Purchased Items (Max Return Qty)</h4>
                                    <div className="rounded-md border border-gray-200 overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHead className="bg-gray-50">
                                                    <TableRow>
                                                        <TableHeader>SKU</TableHeader>
                                                        <TableHeader>Purchased Qty</TableHeader>
                                                        <TableHeader>Cost</TableHeader>
                                                        <TableHeader>Return Qty</TableHeader>
                                                        <TableHeader>Action</TableHeader>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {purchaseItems.map(pi => (
                                                        <TableRow key={pi.id}>
                                                            <TableCell>{pi.item.sku}</TableCell>
                                                            <TableCell>{pi.qty}</TableCell>
                                                            <TableCell>{pi.unit_cost}</TableCell>
                                                            <TableCell>
                                                                <Input
                                                                    id={`qty-${pi.id}`}
                                                                    type="number"
                                                                    defaultValue={0}
                                                                    min={0}
                                                                    max={pi.qty}
                                                                    className="w-24 h-8"
                                                                    containerClassName="mb-0"
                                                                />
                                                            </TableCell>
                                                            <TableCell>
                                                                <Button size="sm" variant="outline" onClick={() => {
                                                                    const val = parseFloat((document.getElementById(`qty-${pi.id}`) as HTMLInputElement).value)
                                                                    handleAddItem(pi, val)
                                                                }}>Add to Return</Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Return Manifest (Draft Preview)</h4>
                                    <div className="rounded-md border border-gray-200 overflow-hidden">
                                        <div className="overflow-x-auto">
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
                                                    <div className="text-sm font-medium text-gray-900">{d.purchases?.vendor?.name}</div>
                                                    <div className="text-xs text-gray-500">Ref: {d.purchases?.purchase_no}</div>
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
