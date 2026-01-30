import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Icons } from './ui/Icons'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog'
import ItemForm from './ItemForm'

type Item = {
    id: string
    sku: string
    name: string
    type: 'FINISHED_GOOD' | 'RAW_MATERIAL'
    uom_id: string
    size_id: string
    color_id: string
    parent_id?: string
    price_umum: number
    price_khusus: number
    default_price_buy: number
    min_stock: number
    is_active: boolean
    // Relations
    uom?: { name: string, code: string }
    size?: { name: string, code: string }
    color?: { name: string, code: string }
    parent?: { name: string }
}

export default function Items() {
    const [items, setItems] = useState<Item[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Form State
    const [editingItem, setEditingItem] = useState<Item | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    // Bulk Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [showBulkPrice, setShowBulkPrice] = useState(false)
    const [bulkPriceType, setBulkPriceType] = useState<'price_umum' | 'price_khusus' | 'default_price_buy'>('price_umum')
    const [bulkPriceValue, setBulkPriceValue] = useState(0)

    const [searchTerm, setSearchTerm] = useState('')

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const fetchItems = useCallback(async () => {
        const { data, error } = await supabase
            .from('items')
            .select(`
                *,
                uom:uoms(name, code),
                size:sizes(name, code),
                color:colors(name, code),
                parent:product_parents(name)
            `)
            .order('sku', { ascending: true })

        if (error) setError(error.message)
        else setItems(data || [])
        setLoading(false)
    }, [])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchItems()
    }, [fetchItems])

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

    async function handleDelete(id: string) {
        if (!confirm("Are you sure?")) return
        const { error } = await supabase.from('items').delete().eq('id', id)
        if (error) alert("Could not delete (referenced). Try deactivating.")
        else fetchItems()
    }

    async function handleBulkUpdate() {
        if (selectedIds.size === 0) return
        if (bulkPriceValue < 0) { setError("Price must be >= 0"); return }

        const updates = { [bulkPriceType]: bulkPriceValue }
        const { error } = await supabase.from('items').update(updates).in('id', Array.from(selectedIds))

        if (error) setError(error.message)
        else {
            setShowBulkPrice(false)
            setSelectedIds(new Set())
            fetchItems()
        }
    }

    function toggleSelection(id: string) {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedIds(newSet)
    }

    return (
        <div className="w-full space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Items Management</h2>
                <Button onClick={handleAddItem} icon={<Icons.Plus className="w-4 h-4" />}>Add Item</Button>
            </div>

            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative flex items-center gap-2"><Icons.Warning className="w-5 h-5 flex-shrink-0" /> {error}</div>}

            {/* List Section Only */}
            <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle>Item List ({filteredItems.length})</CardTitle>
                    <div className="flex items-center space-x-2">
                        <div className="w-40">
                            <Input
                                placeholder="Search items..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="h-8 text-xs mb-0"
                                containerClassName="mb-0"
                            />
                        </div>
                        {selectedIds.size > 0 && (
                            <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-500">{selectedIds.size} selected</span>
                                <Button size="sm" variant="outline" onClick={() => setShowBulkPrice(true)}>Bulk Price</Button>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {showBulkPrice && (
                        <div className="bg-blue-50 p-4 rounded mb-4 border border-blue-200">
                            <h4 className="font-semibold mb-2 text-sm text-blue-900">Bulk Price Update</h4>
                            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
                                <div className="flex-1">
                                    <Select
                                        options={[
                                            { label: 'Price Umum', value: 'price_umum' },
                                            { label: 'Price Khusus', value: 'price_khusus' },
                                            { label: 'Buy Price', value: 'default_price_buy' }
                                        ]}
                                        value={bulkPriceType}
                                        onChange={e => setBulkPriceType(e.target.value as 'price_umum' | 'price_khusus' | 'default_price_buy')}
                                    />
                                </div>
                                <div className="flex-1">
                                    <Input type="number" value={bulkPriceValue} onChange={e => setBulkPriceValue(parseFloat(e.target.value))} placeholder="New Price" />
                                </div>
                                <div className="flex space-x-2 mb-2">
                                    <Button size="sm" onClick={handleBulkUpdate}>Apply</Button>
                                    <Button size="sm" variant="secondary" onClick={() => setShowBulkPrice(false)}>Cancel</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {loading ? <p className="text-center py-8 text-gray-500">Loading...</p> : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableHeader className="w-10">
                                            <input type="checkbox" disabled />
                                        </TableHeader>
                                        <TableHeader>SKU</TableHeader>
                                        <TableHeader>Name / Variant</TableHeader>
                                        <TableHeader>Type</TableHeader>
                                        <TableHeader>Price</TableHeader>
                                        <TableHeader>Stock</TableHeader>
                                        <TableHeader>Actions</TableHeader>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredItems.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(item.id)}
                                                    onChange={() => toggleSelection(item.id)}
                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium text-xs font-mono">{item.sku}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-xs text-gray-500 flex gap-1 mt-0.5">
                                                    {item.parent && <span className="bg-purple-100 text-purple-700 px-1 rounded">{item.parent.name}</span>}
                                                    {item.size && <span className="bg-gray-100 px-1 rounded">{item.size.code}</span>}
                                                    {item.color && <span className="bg-gray-100 px-1 rounded">{item.color.code}</span>}
                                                    {item.uom && <span className="bg-gray-100 px-1 rounded">{item.uom.code}</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold ${item.type === 'FINISHED_GOOD' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                    {item.type === 'FINISHED_GOOD' ? 'FG' : 'RM'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">{item.price_umum.toLocaleString()}</div>
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
                        </div>
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
        </div>
    )
}
