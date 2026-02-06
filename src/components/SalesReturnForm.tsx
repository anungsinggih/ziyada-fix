import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { Button } from "./ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Select } from "./ui/Select";
import { Input } from "./ui/Input";
import { Separator } from "./ui/Separator";
import LineItemsTable from "./shared/LineItemsTable";
import { formatCurrency } from "../lib/format";

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

type Props = {
    onSuccess: (msg: string) => void;
    onError: (msg: string) => void;
};

export function SalesReturnForm({ onSuccess, onError }: Props) {
    const [postedSales, setPostedSales] = useState<Sale[]>([])
    const [selectedSaleId, setSelectedSaleId] = useState('')
    const [salesItems, setSalesItems] = useState<SaleItem[]>([])
    const [lines, setLines] = useState<ReturnItem[]>([])
    const [loading, setLoading] = useState(false)
    const linesTotal = lines.reduce((sum, line) => sum + (line.subtotal || 0), 0)
    const availableRows = salesItems.map((item) => ({
        ...item,
        _inputId: `qty-${item.id}`,
    }))

    const fetchPostedSales = useCallback(async () => {
        const { data, error } = await supabase
            .from('sales')
            .select('*, customer:customers(name)')
            .eq('status', 'POSTED')
            .order('sales_date', { ascending: false })
            .limit(50)

        if (error) onError(error.message)
        else setPostedSales(data || [])
    }, [onError])

    useEffect(() => {
        fetchPostedSales()
    }, [fetchPostedSales])

    const fetchSalesItems = useCallback(async (salesId: string) => {
        const { data, error } = await supabase
            .from('sales_items')
            .select('*, avg_cost_snapshot, item:items(sku, name)')
            .eq('sales_id', salesId)

        if (error) onError(error.message)
        else setSalesItems(data || [])
    }, [onError])

    // Load items when Sale Selected
    useEffect(() => {
        if (!selectedSaleId) {
            setSalesItems([])
            setLines([])
            return
        }
        fetchSalesItems(selectedSaleId)
    }, [selectedSaleId, fetchSalesItems])

    function handleAddItem(sItem: SaleItem, returnQty: number) {
        if (returnQty <= 0) return
        if (returnQty > sItem.qty) {
            alert(`Cannot return more than sold qty (${sItem.qty})`)
            return
        }

        const existing = lines.find(l => l.item_id === sItem.item_id)
        if (existing) {
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
        if (lines.length === 0) { onError("No items to return"); return }

        setLoading(true)

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
                cost_snapshot: l.cost_snapshot, // Important for stock valuation
                subtotal: l.subtotal
            }))

            const { error: linesError } = await supabase.from('sales_return_items').insert(itemsPayload)
            if (linesError) throw linesError

            onSuccess(`Return Draft Created: ${retData.id}`)
            setLines([])
            setSelectedSaleId('')
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
                <CardHeader className="bg-blue-50/50 pb-4 border-b border-blue-100">
                    <CardTitle className="text-blue-900">1. Select Original Sales</CardTitle>
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
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">Available Items (Max Return Qty)</h4>
                            <LineItemsTable
                                title="Available Items"
                                rows={availableRows}
                                columns={[
                                    {
                                        label: 'SKU',
                                        render: (row: SaleItem & { _inputId: string }) => row.item.sku,
                                    },
                                    {
                                        label: 'Sold Qty',
                                        headerClassName: 'text-right',
                                        cellClassName: 'text-right',
                                        render: (row: SaleItem & { _inputId: string }) => row.qty,
                                    },
                                    {
                                        label: 'Unit Price',
                                        headerClassName: 'text-right',
                                        cellClassName: 'text-right',
                                        render: (row: SaleItem & { _inputId: string }) => formatCurrency(row.unit_price),
                                    },
                                    {
                                        label: 'Return Qty',
                                        render: (row: SaleItem & { _inputId: string }) => (
                                            <Input
                                                id={row._inputId}
                                                type="number"
                                                defaultValue=""
                                                placeholder="0"
                                                min={0}
                                                max={row.qty}
                                                className="w-24 h-8"
                                            />
                                        ),
                                    },
                                    {
                                        label: 'Action',
                                        render: (row: SaleItem & { _inputId: string }) => (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    const raw = (document.getElementById(row._inputId) as HTMLInputElement).value
                                                    const val = raw === "" ? 0 : parseFloat(raw)
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
