import { useEffect, useState, useCallback } from 'react'
import { supabase } from "../supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Badge } from './ui/Badge'
import { Icons } from './ui/Icons'
import { Input } from './ui/Input'

interface DisplayItem {
    id?: string
    trx_date: string;
    trx_type: string;
    ref_no: string;
    qty_in: number;
    qty_out: number;
    balance?: number;
    // Global
    item_name?: string;
    sku?: string;
}

type StockCardRow = {
    trx_date: string
    trx_type: string
    ref_no: string
    qty_change: number
    item_name?: string | null
    sku?: string | null
    item_id?: string
    created_at?: string
}

export default function StockCard({ itemId }: { itemId?: string | null }) {
    const [loading, setLoading] = useState(false)
    const [displayList, setDisplayList] = useState<DisplayItem[]>([])
    const [itemName, setItemName] = useState("")

    // Date Filter for Specific Item
    const [startDate, setStartDate] = useState(() => {
        const d = new Date(); d.setDate(1);
        return d.toISOString().split('T')[0]
    })
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

    const fetchGlobalFeed = useCallback(async () => {
        setTimeout(() => setLoading(true), 0)
        const { data, error } = await supabase
            .from('view_stock_card')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20)

        if (!error && data) {
            const mapped: DisplayItem[] = (data as StockCardRow[]).map((m) => ({
                trx_date: m.trx_date,
                trx_type: m.trx_type,
                ref_no: m.ref_no,
                qty_in: m.qty_change > 0 ? m.qty_change : 0,
                qty_out: m.qty_change < 0 ? Math.abs(m.qty_change) : 0,
                item_name: m.item_name || undefined,
                sku: m.sku || undefined
            }))
            setDisplayList(mapped)
        }
        setLoading(false)
    }, [])

    const fetchItemCard = useCallback(async () => {
        if (!itemId) return
        setTimeout(() => setLoading(true), 0)

        // Get Item Name
        const { data: itemData } = await supabase.from('items').select('name').eq('id', itemId).single()
        if (itemData) setItemName(itemData.name)

        // 1. Opening
        const { data: openData } = await supabase.from('view_stock_card')
            .select('qty_change')
            .eq('item_id', itemId)
            .or(`trx_date.lt.${startDate},and(trx_type.eq.OPENING,trx_date.eq.${startDate})`)

        const openingQty = (openData as StockCardRow[] | null | undefined)
            ?.reduce((sum, row) => sum + row.qty_change, 0) || 0

        // 2. Movements
        const { data: movData } = await supabase.from('view_stock_card')
            .select('*')
            .eq('item_id', itemId)
            .gte('trx_date', startDate)
            .lte('trx_date', endDate)
            .neq('trx_type', 'OPENING')
            .order('trx_date', { ascending: true })
            .order('created_at', { ascending: true })

        if (movData) {
            let running = openingQty
            const res: DisplayItem[] = []

            // Opening Row
            res.push({
                trx_date: startDate,
                trx_type: 'OPENING',
                ref_no: '-',
                qty_in: 0,
                qty_out: 0,
                balance: openingQty
            })

            ;(movData as StockCardRow[]).forEach((m) => {
                running += m.qty_change
                res.push({
                    trx_date: m.trx_date,
                    trx_type: m.trx_type,
                    ref_no: m.ref_no,
                    qty_in: m.qty_change > 0 ? m.qty_change : 0,
                    qty_out: m.qty_change < 0 ? Math.abs(m.qty_change) : 0,
                    balance: running
                })
            })
            setDisplayList(res)
        }
        setLoading(false)
    }, [itemId, startDate, endDate])

    useEffect(() => {
        if (itemId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchItemCard()
        } else {
            fetchGlobalFeed()
        }
    }, [itemId, fetchGlobalFeed, fetchItemCard])

    return (
        <Card className="h-full shadow-md border-l-4 border-l-blue-500">
            <CardHeader className="bg-gray-50/80 border-b border-gray-100 pb-4">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-2 md:gap-4">
                    <CardTitle className="text-blue-900 flex items-center gap-2 min-w-0 flex-1">
                        <Icons.Clock className="w-5 h-5 flex-shrink-0" />
                        <span className="truncate">{itemId ? `Kartu Stok: ${itemName}` : "Aktivitas Gudang Terbaru"}</span>
                    </CardTitle>

                    {itemId && (
                        <div className="flex items-center gap-2 text-sm w-full xl:w-auto flex-shrink-0">
                            <Input
                                type="date"
                                className="flex-1 sm:w-32 h-9 text-xs"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                            />
                            <span className="text-gray-400">to</span>
                            <Input
                                type="date"
                                className="flex-1 sm:w-32 h-9 text-xs"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                            />
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto max-h-[500px] lg:max-h-[700px]">
                <Table>
                    <TableHeader className="bg-gray-50 sticky top-0 z-10">
                        <TableRow>
                            <TableHead className="w-24">Date</TableHead>
                            {!itemId && <TableHead>Item</TableHead>}
                            <TableHead>Type / Ref</TableHead>
                            <TableHead className="text-right text-green-700">In</TableHead>
                            <TableHead className="text-right text-red-700">Out</TableHead>
                            {itemId && <TableHead className="text-right font-bold">Balance</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-10">Loading...</TableCell></TableRow>
                        ) : displayList.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-10 text-gray-400">No movements found</TableCell></TableRow>
                        ) : (
                            displayList.map((row, idx) => (
                                <TableRow key={idx} className="hover:bg-gray-50">
                                    <TableCell className="text-xs">{row.trx_date}</TableCell>
                                    {!itemId && (
                                        <TableCell>
                                            <div className="font-medium text-xs">{row.item_name}</div>
                                            <div className="text-[10px] text-gray-500">{row.sku}</div>
                                        </TableCell>
                                    )}
                                    <TableCell>
                                        <Badge variant="outline" className="text-[10px] mb-1">{row.trx_type}</Badge>
                                        <div className="text-xs text-gray-500 truncate max-w-[120px]" title={row.ref_no}>{row.ref_no}</div>
                                    </TableCell>
                                    <TableCell className="text-right text-xs text-green-700 font-medium">
                                        {row.qty_in > 0 ? `+${row.qty_in}` : '-'}
                                    </TableCell>
                                    <TableCell className="text-right text-xs text-red-700 font-medium">
                                        {row.qty_out > 0 ? `-${row.qty_out}` : '-'}
                                    </TableCell>
                                    {itemId && (
                                        <TableCell className="text-right text-xs font-bold bg-gray-50/50">
                                            {row.balance?.toLocaleString()}
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
