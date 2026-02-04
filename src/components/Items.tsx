import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Icons } from './ui/Icons'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog'
import ItemForm from './ItemForm'
import { ItemImportDialog } from './ItemImportDialog'
import { usePagination } from '../hooks/usePagination'
import { Pagination } from './ui/Pagination'

type Item = {
    id: string
    sku: string
    name: string
    type: 'FINISHED_GOOD' | 'RAW_MATERIAL' | 'TRADED'
    uom_id: string
    size_id: string
    color_id: string
    price_default: number
    price_khusus: number
    default_price_buy: number
    min_stock: number
    is_active: boolean
    // Relations
    uom?: { name: string, code: string }
    size?: { name: string, code: string }
    color?: { name: string, code: string }
    brand?: { name: string }
    category?: { name: string }
}

export default function Items() {
    const [items, setItems] = useState<Item[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Form State
    const [editingItem, setEditingItem] = useState<Item | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isImportOpen, setIsImportOpen] = useState(false)

    const [searchTerm, setSearchTerm] = useState('')
    const [typeFilter, setTypeFilter] = useState<'all' | 'sales' | 'RAW_MATERIAL'>('all')

    const { page, setPage, pageSize, range } = usePagination();
    const [totalCount, setTotalCount] = useState(0);

    const filteredItems = items // Client-side filtering is no longer fully accurate, but we keep it for immediate feedback on the current page if needed, or we rely purely on server-side.
    // Ideally, for server-side pagination, search/filter should also be server-side.
    // Let's update fetchItems to handle search/filter + pagination.

    const fetchItems = useCallback(async () => {
        setLoading(true)
        try {
            let query = supabase
                .from('items')
                .select(`
                    *,
                    brand:brands(name),
                    category:categories(name),
                    uom:uoms(name, code),
                    size:sizes(name, code),
                    color:colors(name, code)
                `, { count: 'exact' })

            // Apply Filters
            if (searchTerm) {
                query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`)
            }

            if (typeFilter === 'sales') {
                query = query.in('type', ['FINISHED_GOOD', 'TRADED'])
            } else if (typeFilter === 'RAW_MATERIAL') {
                query = query.eq('type', 'RAW_MATERIAL')
            }

            // Apply Pagination
            const { data, error, count } = await query
                .order('sku', { ascending: true })
                .range(range[0], range[1])

            if (error) throw error

            setItems(data || [])
            setTotalCount(count || 0)
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [range, searchTerm, typeFilter])

    useEffect(() => {
        fetchItems()
    }, [fetchItems])

    // Reset page when filters change
    useEffect(() => {
        setPage(1)
    }, [searchTerm, typeFilter, setPage])


    function handleSuccess() {
        setEditingItem(null)
        setIsModalOpen(false)
        setLoading(true)
        fetchItems()
    }

    function handleEdit(item: Item) {
        setEditingItem(item)
        setIsModalOpen(true)
    }

    function handleAddItem() {
        setEditingItem(null)
        setIsModalOpen(true)
    }

    function handleImportSuccess() {
        setLoading(true)
        fetchItems()
    }

    async function handleDelete(id: string) {
        if (!confirm("Are you sure?")) return
        const { error } = await supabase.from('items').delete().eq('id', id)
        if (error) alert("Could not delete (referenced). Try deactivating.")
        else fetchItems()
    }

    return (
        <div className="w-full space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="hidden md:block text-2xl font-bold tracking-tight">Items Management</h2>
                <div className="flex gap-2">
                    <Button
                        onClick={() => setIsImportOpen(true)}
                        variant="outline"
                        icon={<Icons.Upload className="w-4 h-4" />}
                        className="w-auto"
                    >
                        Import
                    </Button>
                    <Button
                        onClick={handleAddItem}
                        icon={<Icons.Plus className="w-4 h-4" />}
                        className="w-auto"
                    >
                        Add Item
                    </Button>
                </div>
            </div>

            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative flex items-center gap-2"><Icons.Warning className="w-5 h-5 flex-shrink-0" /> {error}</div>}

            {/* List Section Only */}
            <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle className="text-sm sm:text-base">Item List ({totalCount})</CardTitle>
                    <div className="flex items-center gap-2">
                        <div className="w-32 sm:w-48">
                            <Input
                                placeholder="Search items..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="h-8 text-xs !mb-0"
                                containerClassName="!mb-0"
                            />
                        </div>
                        <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1">
                            {[
                                { label: 'All', value: 'all' as const },
                                { label: 'Sales Items', value: 'sales' as const },
                                { label: 'Raw', value: 'RAW_MATERIAL' as const },
                            ].map(tab => (
                                <button
                                    key={tab.value}
                                    type="button"
                                    onClick={() => setTypeFilter(tab.value)}
                                    className={`px-2 py-1 text-xs rounded ${typeFilter === tab.value ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? <p className="text-center py-8 text-gray-500">Loading...</p> : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>SKU</TableHead>
                                        <TableHead>Name / Variant</TableHead>
                                        <TableHead>Size</TableHead>
                                        <TableHead>Color</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Price Umum</TableHead>
                                        <TableHead>Price Khusus</TableHead>
                                        <TableHead>Stock</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredItems.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium text-xs font-mono">{item.sku}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-xs text-gray-500 flex gap-1 mt-0.5">
                                                    {item.brand && <span className="bg-slate-100 px-1 rounded">{item.brand.name}</span>}
                                                    {item.category && <span className="bg-slate-100 px-1 rounded">{item.category.name}</span>}
                                                    {item.uom && <span className="bg-gray-100 px-1 rounded">{item.uom.code}</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {item.size ? (item.size.code || item.size.name) : '-'}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {item.color ? (item.color.code || item.color.name) : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold 
                                                ${item.type === 'FINISHED_GOOD' ? 'bg-green-100 text-green-800' :
                                                        item.type === 'TRADED' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-yellow-100 text-yellow-800'}`}>
                                                    {item.type === 'FINISHED_GOOD' ? 'FG' :
                                                        item.type === 'TRADED' ? 'TD' : 'RM'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">{item.price_default.toLocaleString()}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">{item.price_khusus.toLocaleString()}</div>
                                            </TableCell>
                                            <TableCell>
                                                {item.is_active
                                                    ? <span className="text-green-600 font-bold text-xs">Active</span>
                                                    : <span className="text-gray-400 font-bold text-xs">Inactive</span>
                                                }
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex space-x-1">
                                                    <Button size="sm" variant="secondary" onClick={() => handleEdit(item)} icon={<Icons.Edit className="w-4 h-4" />} />
                                                    <Button size="sm" variant="danger" onClick={() => handleDelete(item.id)} icon={<Icons.Trash className="w-4 h-4" />} />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <Pagination
                                currentPage={page}
                                totalCount={totalCount}
                                pageSize={pageSize}
                                onPageChange={setPage}
                                isLoading={loading}
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <DialogHeader>
                    <DialogTitle>{editingItem ? 'Edit Item' : 'New Item'}</DialogTitle>
                </DialogHeader>
                <DialogContent>
                    <ItemForm
                        existingItem={editingItem}
                        onSuccess={handleSuccess}
                        onCancel={() => setIsModalOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            <ItemImportDialog
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
                onSuccess={handleImportSuccess}
            />
        </div >
    )
}
