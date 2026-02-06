import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { Button } from "./ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Select } from "./ui/Select";
import { Input } from "./ui/Input";
import { Separator } from "./ui/Separator";

import { formatCurrency } from "../lib/format";
import { getErrorMessage } from "../lib/errors";
import { useLocation } from "react-router-dom";

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
    const [draftReturnDate, setDraftReturnDate] = useState<string | null>(null)
    const linesTotal = lines.reduce((sum, line) => sum + (line.subtotal || 0), 0)
    const availableRows = salesItems.map((item) => ({
        ...item,
        _inputId: `qty-${item.id}`,
    }))
    const location = useLocation()
    const draftId = useMemo(() => new URLSearchParams(location.search).get('draft'), [location.search])
    const isEditing = Boolean(draftId)

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

    const fetchDraft = useCallback(async (returnId: string) => {
        setLoading(true)
        try {
            const { data: header, error: headerError } = await supabase
                .from('sales_returns')
                .select('id, sales_id, return_date, status')
                .eq('id', returnId)
                .single()
            if (headerError) throw headerError

            setSelectedSaleId(header.sales_id)
            setDraftReturnDate(header.return_date)

            const { data: itemsData, error: itemsError } = await supabase
                .from('sales_return_items')
                .select(`
                    item_id,
                    qty,
                    unit_price,
                    cost_snapshot,
                    uom_snapshot,
                    subtotal,
                    items (sku, name)
                `)
                .eq('sales_return_id', returnId)
            if (itemsError) throw itemsError

            setLines(itemsData?.map(item => ({
                item_id: item.item_id,
                sku: (item.items as unknown as { sku: string })?.sku || '',
                name: (item.items as unknown as { name: string })?.name || '',
                qty: item.qty,
                unit_price: item.unit_price,
                uom: item.uom_snapshot,
                subtotal: item.subtotal,
                cost_snapshot: item.cost_snapshot
            })) || [])
        } catch (err: unknown) {
            onError(getErrorMessage(err, 'Failed to load draft'))
        } finally {
            setLoading(false)
        }
    }, [onError])

    useEffect(() => {
        if (draftId) {
            fetchDraft(draftId)
        }
    }, [draftId, fetchDraft])

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
            const returnDate = draftReturnDate || new Date().toISOString().split('T')[0]

            if (isEditing && draftId) {
                const { error: updateError } = await supabase
                    .from('sales_returns')
                    .update({
                        sales_id: selectedSaleId,
                        return_date: returnDate,
                        status: 'DRAFT'
                    })
                    .eq('id', draftId)
                if (updateError) throw updateError

                const { error: delError } = await supabase
                    .from('sales_return_items')
                    .delete()
                    .eq('sales_return_id', draftId)
                if (delError) throw delError

                const itemsPayload = lines.map(l => ({
                    sales_return_id: draftId,
                    item_id: l.item_id,
                    uom_snapshot: l.uom,
                    qty: l.qty,
                    unit_price: l.unit_price,
                    cost_snapshot: l.cost_snapshot, // Important for stock valuation
                    subtotal: l.subtotal
                }))

                const { error: linesError } = await supabase.from('sales_return_items').insert(itemsPayload)
                if (linesError) throw linesError

                onSuccess(`Return Draft Updated: ${draftId}`)
            } else {
                // 1. Header
                const { data: retData, error: retError } = await supabase
                    .from('sales_returns')
                    .insert([{
                        sales_id: selectedSaleId,
                        return_date: returnDate,
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
            }

            setLines([])
            if (!isEditing) {
                setSelectedSaleId('')
            }
        } catch (err: unknown) {
            onError(getErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-md border-gray-200">
                <CardHeader className="bg-blue-50/50 pb-4 border-b border-blue-100">
                    <CardTitle className="text-blue-900 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold ring-1 ring-blue-200">1</span>
                        Select Original Sales
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <Select
                        label="Sales Invoice Source"
                        value={selectedSaleId}
                        onChange={e => setSelectedSaleId(e.target.value)}
                        disabled={isEditing}
                        className="font-mono text-sm"
                        options={[
                            { label: "-- Select Invoice --", value: "" },
                            ...postedSales.map(s => ({
                                label: `${s.sales_date} • ${s.sales_no || 'No Ref'} • ${s.customer.name} • ${formatCurrency(s.total_amount)}`,
                                value: s.id
                            }))
                        ]}
                    />
                </CardContent>
            </Card>

            {selectedSaleId && (
                <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
                    {/* Available Items Section */}
                    <Card className="shadow-md border-gray-200">
                        <CardHeader className="bg-gray-50/50 pb-4 border-b border-gray-100">
                            <CardTitle className="text-gray-800 flex items-center gap-2">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-bold ring-1 ring-gray-200">2</span>
                                Select Items to Return
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-8">

                            {/* Available Items Table */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                    Available Items from Invoice
                                </h4>
                                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                                <tr>
                                                    <th className="px-4 py-3">Item / SKU</th>
                                                    <th className="px-4 py-3 text-right">Sold Qty</th>
                                                    <th className="px-4 py-3 text-right">Price</th>
                                                    <th className="px-4 py-3 text-center w-32">Return Qty</th>
                                                    <th className="px-4 py-3 text-right w-24">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 bg-white">
                                                {availableRows.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="px-4 py-8 text-center text-gray-400 italic">No items found in this invoice</td>
                                                    </tr>
                                                ) : (
                                                    availableRows.map((row) => (
                                                        <tr key={row.id} className="hover:bg-blue-50/30 transition-colors group">
                                                            <td className="px-4 py-2">
                                                                <div className="font-medium text-gray-900">{row.item.name}</div>
                                                                <div className="text-xs text-gray-500 font-mono">{row.item.sku}</div>
                                                            </td>
                                                            <td className="px-4 py-2 text-right font-mono text-gray-600">{row.qty}</td>
                                                            <td className="px-4 py-2 text-right font-mono text-gray-600">{formatCurrency(row.unit_price)}</td>
                                                            <td className="px-4 py-2">
                                                                <Input
                                                                    id={row._inputId}
                                                                    type="number"
                                                                    defaultValue=""
                                                                    placeholder="0"
                                                                    min={0}
                                                                    max={row.qty}
                                                                    className="h-8 text-center"
                                                                    containerClassName="!mb-0"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === "Enter") {
                                                                            e.preventDefault();
                                                                            const raw = (e.target as HTMLInputElement).value;
                                                                            const val = raw === "" ? 0 : parseFloat(raw);
                                                                            handleAddItem(row, val);
                                                                            (e.target as HTMLInputElement).value = ""; // Reset after add
                                                                        }
                                                                    }}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2 text-right">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 text-xs hover:bg-blue-100 hover:text-blue-700 hover:border-blue-300 transition-all"
                                                                    onClick={() => {
                                                                        const inputEl = document.getElementById(row._inputId) as HTMLInputElement;
                                                                        const val = inputEl.value === "" ? 0 : parseFloat(inputEl.value);
                                                                        handleAddItem(row, val);
                                                                        inputEl.value = ""; // Reset after add
                                                                    }}
                                                                >
                                                                    Add
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Cart / Draft Preview */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                        Return Draft Items
                                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px]">{lines.length}</span>
                                    </h4>
                                    {linesTotal > 0 && (
                                        <div className="text-sm font-semibold text-gray-900 bg-green-50 px-3 py-1 rounded border border-green-100">
                                            Total: {formatCurrency(linesTotal)}
                                        </div>
                                    )}
                                </div>

                                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-gray-50/30">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-100 text-gray-500 font-medium border-b border-gray-200">
                                                <tr>
                                                    <th className="px-4 py-3">Item / SKU</th>
                                                    <th className="px-4 py-3 text-right">Return Qty</th>
                                                    <th className="px-4 py-3 text-right">Price Credit</th>
                                                    <th className="px-4 py-3 text-right">Subtotal</th>
                                                    <th className="px-4 py-3 text-right w-16"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 bg-white">
                                                {lines.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="px-4 py-12 text-center text-gray-400 italic">
                                                            No items added to return draft yet.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    lines.map((line, index) => (
                                                        <tr key={index} className="hover:bg-red-50/10 transition-colors">
                                                            <td className="px-4 py-3">
                                                                <div className="font-medium text-gray-900">{line.name}</div>
                                                                <div className="text-xs text-gray-500 font-mono">{line.sku}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono">
                                                                {line.qty} <span className="text-gray-400 text-xs">{line.uom}</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono text-gray-600">{formatCurrency(line.unit_price)}</td>
                                                            <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">{formatCurrency(line.subtotal)}</td>
                                                            <td className="px-4 py-3 text-right">
                                                                <button
                                                                    onClick={() => removeLine(index)}
                                                                    className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                            {lines.length > 0 && (
                                                <tfoot className="bg-gray-50 font-semibold border-t border-gray-200">
                                                    <tr>
                                                        <td colSpan={3} className="px-4 py-3 text-right text-gray-600">Total Return Value</td>
                                                        <td className="px-4 py-3 text-right font-mono text-gray-900">{formatCurrency(linesTotal)}</td>
                                                        <td></td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4">
                                    <Button
                                        onClick={handleSaveDraft}
                                        disabled={loading || lines.length === 0}
                                        className="w-full sm:w-auto min-w-[150px] bg-blue-600 hover:bg-blue-700 shadow-sm"
                                        isLoading={loading}
                                    >
                                        Save Return Draft
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
