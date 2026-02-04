import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/Table";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Icons } from "./ui/Icons";
import { Badge } from "./ui/Badge";
import { usePagination } from "../hooks/usePagination";
import { Pagination } from "./ui/Pagination";

type InventoryItem = {
    id: string
    sku: string
    name: string
    uom: string
    category_id?: string
    size_name?: string
    color_name?: string
    inventory_stock?: {
        qty_on_hand: number
        avg_cost: number
    }
}

type Props = {
    selectedId: string | null
    onSelect: (id: string | null) => void
    onAdjust: (id: string, name: string) => void
    refreshTrigger: number
}

export function InventoryList({ selectedId, onSelect, onAdjust, refreshTrigger }: Props) {
    const [items, setItems] = useState<InventoryItem[]>([])
    const [search, setSearch] = useState("")
    const [loading, setLoading] = useState(false)

    const { page, setPage, pageSize, range } = usePagination();
    const [pageCount, setPageCount] = useState(0);

    const fetchInventory = useCallback(async () => {
        setLoading(true)
        // Fetch items with stock
        let query = supabase
            .from('items')
            .select('id, sku, name, uom, sizes(name), colors(name), inventory_stock(qty_on_hand, avg_cost)', { count: 'exact' })
            .eq('is_active', true)

        if (search) {
            query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
        }

        const { data, error, count } = await query
            .order('name')
            .range(range[0], range[1])

        if (!error && data) {
            // Flatten or handle array
            const formatted = data.map(d => ({
                ...d,
                size_name: (d.sizes as unknown as { name: string } | null)?.name,
                color_name: (d.colors as unknown as { name: string } | null)?.name,
                inventory_stock: Array.isArray(d.inventory_stock) ? d.inventory_stock[0] : d.inventory_stock
            })) as InventoryItem[]
            setItems(formatted)
            setPageCount(count || 0)
        }
        setLoading(false)
    }, [range, search])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchInventory()
    }, [fetchInventory, refreshTrigger])

    // Reset page on search
    useEffect(() => {
        setPage(1);
    }, [search, setPage]);

    // Derived state for display
    const filtered = items; // filtered is now just items, as filtering happens server-side

    return (
        <Card className="h-full shadow-md flex flex-col">
            <CardHeader className="bg-white border-b border-gray-100 pb-4">
                <div className="flex justify-between items-center mb-2">
                    <CardTitle className="text-gray-800">Cek Stok</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
                        Reset View
                    </Button>
                </div>
                <div className="relative">
                    <Icons.Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                        placeholder="Cari SKU atau Nama Barang..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9"
                        containerClassName="!mb-0"
                    />
                </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto max-h-[500px] lg:max-h-[700px]">
                <Table>
                    <TableHeader className="sticky top-0 bg-gray-50 z-10 shadow-sm">
                        <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="w-20">Size</TableHead>
                            <TableHead className="w-20">Color</TableHead>
                            <TableHead className="text-right">Stok</TableHead>
                            <TableHead>&nbsp;</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={3} className="text-center py-8">Loading...</TableCell></TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center py-8 text-gray-400">Tak ada barang</TableCell></TableRow>
                        ) : (
                            filtered.map(item => {
                                const stock = item.inventory_stock?.qty_on_hand || 0
                                const isSelected = selectedId === item.id
                                return (
                                    <TableRow
                                        key={item.id}
                                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                        onClick={() => onSelect(isSelected ? null : item.id)}
                                    >
                                        <TableCell>
                                            <div className="font-semibold text-gray-900">{item.name}</div>
                                            <div className="text-xs text-gray-500 font-mono">{item.sku}</div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {item.size_name || '-'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {item.color_name || '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant={stock > 0 ? 'success' : 'secondary'} className="text-sm">
                                                {stock.toLocaleString()} {item.uom}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onAdjust(item.id, item.name);
                                                }}
                                                title="Adjust Stock"
                                            >
                                                <Icons.Edit className="w-3 h-3" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </CardContent>
            <Pagination
                currentPage={page}
                totalCount={pageCount}
                pageSize={pageSize}
                onPageChange={setPage}
                isLoading={loading}
                className="border-t border-gray-100"
            />
        </Card>
    )
}
