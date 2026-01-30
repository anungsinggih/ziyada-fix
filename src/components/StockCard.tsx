import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Card, CardContent } from './ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Icons } from './ui/Icons'

type Item = { id: string; name: string; sku: string; uom: string }
type StockMovement = {
    trx_date: string
    trx_type: string
    ref_no: string
    qty_change: number
    uom: string
    created_at: string
}

export default function StockCard() {
    const [items, setItems] = useState<Item[]>([])
    const [itemId, setItemId] = useState('')
    const [error, setError] = useState<string | null>(null)

    // Date Filter
    const [startDate, setStartDate] = useState(() => {
        const d = new Date(); d.setDate(1);
        return d.toISOString().split('T')[0]
    })
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

    interface DisplayItem {
        trx_date: string;
        trx_type: string;
        ref_no: string;
        qty_in: number;
        qty_out: number;
        balance: number;
    }
    const [displayList, setDisplayList] = useState<DisplayItem[]>([])

    const fetchItems = useCallback(async () => {
        const { data, error } = await supabase.from('items').select('id, name, sku, uom').order('name')
        if (error) setError(error.message)
        else setItems(data || [])
    }, [])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchItems()
    }, [fetchItems])

    const processList = useCallback((opening: number, list: StockMovement[]) => {
        let running: number = opening
        const res: DisplayItem[] = []
        res.push({ trx_date: startDate, trx_type: 'OPENING', ref_no: '-', qty_in: 0, qty_out: 0, balance: opening })
        list.forEach(m => {
            running += m.qty_change
            res.push({
                trx_date: m.trx_date, trx_type: m.trx_type, ref_no: m.ref_no,
                qty_in: m.qty_change > 0 ? m.qty_change : 0,
                qty_out: m.qty_change < 0 ? Math.abs(m.qty_change) : 0,
                balance: running
            })
        })
        setDisplayList(res)
    }, [startDate])

    const fetchCard = useCallback(async () => {
        setError(null)
        // 1. Opening
        const { data: openData, error: openError } = await supabase.from('view_stock_card')
            .select('qty_change').eq('item_id', itemId).lt('trx_date', startDate)
        if (openError) { setError(openError.message); return }
        const openingQty = openData?.reduce((sum, row) => sum + row.qty_change, 0) || 0

        // 2. Movements
        const { data: movData, error: movError } = await supabase.from('view_stock_card')
            .select('*').eq('item_id', itemId).gte('trx_date', startDate).lte('trx_date', endDate)
            .order('trx_date', { ascending: true }).order('created_at', { ascending: true })

        if (movError) { setError(movError.message); return }
        if (movData) processList(openingQty, movData as StockMovement[])
    }, [itemId, startDate, endDate, processList])

    useEffect(() => {
        if (itemId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchCard()
        }
    }, [itemId, startDate, endDate, fetchCard])

    return (
        <div className="w-full space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Stock Card</h2>
            </div>
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>}

            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4 items-end mb-6">
                        <div className="flex-grow md:w-1/2">
                            <Select
                                label="Item"
                                value={itemId}
                                onChange={e => setItemId(e.target.value)}
                                options={[{ label: '-- Select Item --', value: '' }, ...items.map(i => ({ label: `${i.sku} - ${i.name}`, value: i.id }))]}
                            />
                        </div>
                        <div className="w-full md:w-auto"><Input label="From" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                        <div className="w-full md:w-auto"><Input label="To" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
                        <div className="pb-2"><Button onClick={fetchCard} icon={<Icons.Refresh className="w-4 h-4" />}>Refresh</Button></div>
                    </div>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeader>Date</TableHeader><TableHeader>Type</TableHeader><TableHeader>Ref</TableHeader>
                                    <TableHeader>In</TableHeader><TableHeader>Out</TableHeader><TableHeader>Balance</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {displayList.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-gray-500">No data selected</TableCell></TableRow> :
                                    displayList.map((row, i) => (
                                        <TableRow key={i} className={row.trx_type === 'OPENING' ? 'bg-yellow-50 font-semibold' : ''}>
                                            <TableCell>{row.trx_date}</TableCell>
                                            <TableCell><span className={`px-2 py-0.5 rounded text-xs ${row.trx_type === 'OPENING' ? 'bg-gray-200' : 'bg-blue-50 text-blue-700'}`}>{row.trx_type}</span></TableCell>
                                            <TableCell>{row.ref_no}</TableCell>
                                            <TableCell className="text-green-600">{row.qty_in > 0 ? `+${row.qty_in}` : '-'}</TableCell>
                                            <TableCell className="text-red-500">{row.qty_out > 0 ? `-${row.qty_out}` : '-'}</TableCell>
                                            <TableCell className="font-bold">{row.balance}</TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
