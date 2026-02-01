import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { Button } from "./ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Select } from "./ui/Select";
import { Input } from "./ui/Input";
import { Separator } from "./ui/Separator";
import LineItemsTable from "./shared/LineItemsTable";
import { formatCurrency } from "../lib/format";

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

type Props = {
    onSuccess: (msg: string) => void;
    onError: (msg: string) => void;
};

export function PurchaseReturnForm({ onSuccess, onError }: Props) {
    const [postedPurchases, setPostedPurchases] = useState<Purchase[]>([])
    const [selectedPurchaseId, setSelectedPurchaseId] = useState('')
    const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([])
    const [lines, setLines] = useState<ReturnItem[]>([])
    const [loading, setLoading] = useState(false)
    const linesTotal = lines.reduce((sum, line) => sum + (line.subtotal || 0), 0)
    const availableRows = purchaseItems.map((item) => ({
        ...item,
        _inputId: `qty-${item.id}`,
    }))

    const fetchPostedPurchases = useCallback(async () => {
        const { data, error } = await supabase
            .from('purchases')
            .select('*, vendor:vendors(name)')
            .eq('status', 'POSTED')
            .order('purchase_date', { ascending: false })
            .limit(50)

        if (error) onError(error.message)
        else setPostedPurchases(data || [])
    }, [onError])

    useEffect(() => {
        fetchPostedPurchases()
    }, [fetchPostedPurchases])

    const fetchPurchaseItems = useCallback(async (purchaseId: string) => {
        const { data, error } = await supabase
            .from('purchase_items')
            .select('*, item:items(sku, name)')
            .eq('purchase_id', purchaseId)

        if (error) onError(error.message)
        else setPurchaseItems(data || [])
    }, [onError])

    // Load items when Purchase Selected
    useEffect(() => {
        if (!selectedPurchaseId) {
            setPurchaseItems([])
            setLines([])
            return
        }
        fetchPurchaseItems(selectedPurchaseId)
    }, [selectedPurchaseId, fetchPurchaseItems])

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
        if (lines.length === 0) { onError("No items to return"); return }

        setLoading(true)

        try {
            // 1. Header
            const { data: retData, error: retError } = await supabase
                .from('purchase_returns')
                .insert([{
                    purchase_id: selectedPurchaseId,
                    return_date: new Date().toISOString().split('T')[0],
                    status: 'DRAFT'
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
                cost_snapshot: l.unit_cost,
                subtotal: l.subtotal
            }))

            const { error: linesError } = await supabase.from('purchase_return_items').insert(itemsPayload)
            if (linesError) throw linesError

            onSuccess(`Return Draft Created: ${retData.id}`)
            setLines([])
            setSelectedPurchaseId('')
        } catch (err: unknown) {
            if (err instanceof Error) onError(err.message)
            else onError('Unknown error')
        } finally {
            setLoading(false)
        }
    }

    return (
            <div className="space-y-6">
            <Card className="shadow-md">
                <CardHeader className="bg-purple-50/50 pb-4 border-b border-purple-100">
                    <CardTitle className="text-purple-900">1. Select Original Purchase</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <Select
                        label="Purchase Bill"
                        value={selectedPurchaseId}
                        onChange={e => setSelectedPurchaseId(e.target.value)}
                        options={[
                            { label: "-- Select Purchase --", value: "" },
                            ...postedPurchases.map(s => ({
                                label: `${s.purchase_date} | ${s.purchase_no || 'No Ref'} | ${s.vendor.name} | ${s.total_amount.toLocaleString()}`,
                                value: s.id
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
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">Available Items (Max Return Qty)</h4>
                            <LineItemsTable
                                title="Available Items"
                                rows={availableRows}
                                columns={[
                                    {
                                        label: 'SKU',
                                        render: (row: PurchaseItem & { _inputId: string }) => row.item.sku,
                                    },
                                    {
                                        label: 'Purchased Qty',
                                        headerClassName: 'text-right',
                                        cellClassName: 'text-right',
                                        render: (row: PurchaseItem & { _inputId: string }) => row.qty,
                                    },
                                    {
                                        label: 'Unit Cost',
                                        headerClassName: 'text-right',
                                        cellClassName: 'text-right',
                                        render: (row: PurchaseItem & { _inputId: string }) => formatCurrency(row.unit_cost),
                                    },
                                    {
                                        label: 'Return Qty',
                                        render: (row: PurchaseItem & { _inputId: string }) => (
                                            <Input
                                                id={row._inputId}
                                                type="number"
                                                defaultValue={0}
                                                min={0}
                                                max={row.qty}
                                                className="w-24 h-8"
                                            />
                                        ),
                                    },
                                    {
                                        label: 'Action',
                                        render: (row: PurchaseItem & { _inputId: string }) => (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    const val = parseFloat((document.getElementById(row._inputId) as HTMLInputElement).value)
                                                    handleAddItem(row, val)
                                                }}
                                            >
                                                Add to Return
                                            </Button>
                                        ),
                                    },
                                ]}
                                emptyLabel="No items available"
                            />
                        </div>

                        <Separator />

                        <div>
                            <LineItemsTable
                                title="Return Draft Preview"
                                rows={lines.map((line, index) => ({ ...line, _index: index }))}
                                columns={[
                                    {
                                        label: 'SKU',
                                        render: (line: ReturnItem & { _index: number }) => line.sku,
                                    },
                                    {
                                        label: 'Qty',
                                        headerClassName: 'text-right',
                                        cellClassName: 'text-right',
                                        render: (line: ReturnItem & { _index: number }) => line.qty,
                                    },
                                    {
                                        label: 'Subtotal',
                                        headerClassName: 'text-right',
                                        cellClassName: 'text-right',
                                        render: (line: ReturnItem & { _index: number }) => formatCurrency(line.subtotal),
                                    },
                                    {
                                        label: 'Action',
                                        render: (line: ReturnItem & { _index: number }) => (
                                            <Button variant="danger" size="sm" onClick={() => removeLine(line._index)}>
                                                Remove
                                            </Button>
                                        ),
                                    },
                                ]}
                                totalValue={formatCurrency(linesTotal)}
                                emptyLabel="No items added yet"
                            />
                            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-sm text-gray-600">
                                    Total Return: <span className="font-semibold">{formatCurrency(linesTotal)}</span>
                                </div>
                                <Button onClick={handleSaveDraft} disabled={loading} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                                    {loading ? 'Saving...' : 'Save Return Draft'}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
