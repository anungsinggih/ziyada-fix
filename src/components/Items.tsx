import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Checkbox } from './ui/Checkbox'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Icons } from './ui/Icons'

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

type MasterData = {
    id: string
    code?: string
    name: string
}

export default function Items() {
    const [items, setItems] = useState<Item[]>([])
    const [uoms, setUoms] = useState<MasterData[]>([])
    const [sizes, setSizes] = useState<MasterData[]>([])
    const [colors, setColors] = useState<MasterData[]>([])
    const [parents, setParents] = useState<MasterData[]>([])

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState<Partial<Item>>({
        sku: '', name: '', type: 'FINISHED_GOOD',
        price_umum: 0, price_khusus: 0, default_price_buy: 0,
        min_stock: 0, is_active: true
    })

    // Bulk Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [showBulkPrice, setShowBulkPrice] = useState(false)
    const [bulkPriceType, setBulkPriceType] = useState<'price_umum' | 'price_khusus' | 'default_price_buy'>('price_umum')
    const [bulkPriceValue, setBulkPriceValue] = useState(0)

    useEffect(() => {
        fetchMasterData()
        fetchItems()
    }, [])

    async function fetchMasterData() {
        const [uomRes, sizeRes, colorRes, parentRes] = await Promise.all([
            supabase.from('uoms').select('id, code, name').eq('is_active', true),
            supabase.from('sizes').select('id, code, name').eq('is_active', true).order('sort_order'),
            supabase.from('colors').select('id, code, name').eq('is_active', true).order('sort_order'),
            supabase.from('product_parents').select('id, name').eq('is_active', true)
        ])

        if (uomRes.data) setUoms(uomRes.data)
        if (sizeRes.data) setSizes(sizeRes.data)
        if (colorRes.data) setColors(colorRes.data)
        if (parentRes.data) setParents(parentRes.data)
    }

    async function fetchItems() {
        setLoading(true)
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
    }

    // Set defaults when master data loads if creating new
    useEffect(() => {
        if (!editingId && uoms.length > 0 && sizes.length > 0 && colors.length > 0) {
            // Only set if not already set
            setFormData(prev => ({
                ...prev,
                uom_id: prev.uom_id || uoms.find(u => u.code === 'PCS')?.id || uoms[0].id,
                size_id: prev.size_id || sizes.find(s => s.code === 'ALL')?.id || sizes[0].id,
                color_id: prev.color_id || colors.find(c => c.code === 'NA')?.id || colors[0].id
            }))
        }
    }, [uoms, sizes, colors, editingId])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)

        if ((formData.price_umum ?? 0) < 0 || (formData.price_khusus ?? 0) < 0 || (formData.default_price_buy ?? 0) < 0) {
            setError("Prices must be >= 0")
            return
        }

        // Sync legacy string 'uom' column if needed
        // Sync legacy string 'uom' column if needed
        const selectedUom = uoms.find(u => u.id === formData.uom_id)

        // Strict payload to avoid sending relation objects (which causes "Could not find column" error)
        const payload = {
            sku: formData.sku,
            name: formData.name,
            type: formData.type,
            uom_id: formData.uom_id,
            size_id: formData.size_id,
            color_id: formData.color_id,
            parent_id: formData.parent_id || null, // Ensure null if undefined/empty
            price_umum: formData.price_umum,
            price_khusus: formData.price_khusus,
            default_price_buy: formData.default_price_buy,
            min_stock: formData.min_stock,
            is_active: formData.is_active,
            uom: selectedUom?.code || 'PCS' // Legacy column
        }

        try {
            if (editingId) {
                const { error } = await supabase.from('items').update(payload).eq('id', editingId)
                if (error) throw error
            } else {
                const { error } = await supabase.from('items').insert([payload])
                if (error) throw error
            }
            resetForm()
            fetchItems()
        } catch (err: any) {
            setError(err.message)
        }
    }

    function resetForm() {
        setEditingId(null)
        // Reset to strict defaults
        const defaultUom = uoms.find(u => u.code === 'PCS')?.id || uoms[0]?.id
        const defaultSize = sizes.find(s => s.code === 'ALL')?.id || sizes[0]?.id
        const defaultColor = colors.find(c => c.code === 'NA')?.id || colors[0]?.id

        setFormData({
            sku: '', name: '', type: 'FINISHED_GOOD',
            uom_id: defaultUom, size_id: defaultSize, color_id: defaultColor, parent_id: undefined,
            price_umum: 0, price_khusus: 0, default_price_buy: 0, min_stock: 0, is_active: true
        })
    }

    function handleEdit(item: Item) {
        setEditingId(item.id)
        setFormData({
            ...item,
            // Ensure IDs are strings
            uom_id: item.uom_id,
            size_id: item.size_id,
            color_id: item.color_id,
            parent_id: item.parent_id || undefined
        })
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
            </div>

            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative flex items-center gap-2"><Icons.Warning className="w-5 h-5 flex-shrink-0" /> {error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                {/* Form Section */}
                <div className="md:col-span-1">
                    <Card>
                        <CardHeader>
                            <CardTitle>{editingId ? 'Edit Item' : 'New Item'}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <Input label="SKU" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} required />
                                    <Select
                                        label="Type"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                                        options={[
                                            { label: 'Finished', value: 'FINISHED_GOOD' },
                                            { label: 'Raw Material', value: 'RAW_MATERIAL' }
                                        ]}
                                    />
                                </div>
                                <Input label="Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />

                                {/* Parent Selector (Optional) */}
                                <Select
                                    label="Parent Product (Optional)"
                                    value={formData.parent_id || ''}
                                    onChange={e => setFormData({ ...formData, parent_id: e.target.value || undefined })}
                                    options={[
                                        { label: '-- No Parent --', value: '' },
                                        ...parents.map(p => ({ label: p.name, value: p.id }))
                                    ]}
                                />

                                <div className="grid grid-cols-3 gap-2">
                                    <Select
                                        label="UoM"
                                        value={formData.uom_id}
                                        onChange={e => setFormData({ ...formData, uom_id: e.target.value })}
                                        options={uoms.map(u => ({ label: u.code || u.name, value: u.id }))}
                                    />
                                    <Select
                                        label="Size"
                                        value={formData.size_id}
                                        onChange={e => setFormData({ ...formData, size_id: e.target.value })}
                                        options={sizes.map(s => ({ label: s.code || s.name, value: s.id }))}
                                    />
                                    <Select
                                        label="Color"
                                        value={formData.color_id}
                                        onChange={e => setFormData({ ...formData, color_id: e.target.value })}
                                        options={colors.map(c => ({ label: c.code || c.name, value: c.id }))}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <Input label="Public Price" type="number" step="0.01" value={formData.price_umum} onChange={e => setFormData({ ...formData, price_umum: parseFloat(e.target.value) })} />
                                    <Input label="Special Price" type="number" step="0.01" value={formData.price_khusus} onChange={e => setFormData({ ...formData, price_khusus: parseFloat(e.target.value) })} />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Input label="Buy Price (Cost)" type="number" step="0.01" value={formData.default_price_buy} onChange={e => setFormData({ ...formData, default_price_buy: parseFloat(e.target.value) })} />
                                    <Input label="Min Stock" type="number" value={formData.min_stock} onChange={e => setFormData({ ...formData, min_stock: parseFloat(e.target.value) })} />
                                </div>

                                <Checkbox label="Active" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />

                                <div className="flex space-x-2 pt-2">
                                    <Button type="submit" className="w-full sm:w-auto min-h-[44px]">{editingId ? 'Update' : 'Add'} Item</Button>
                                    {editingId && <Button type="button" variant="secondary" onClick={resetForm} className="w-full">Cancel</Button>}
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* List Section */}
                <div className="md:col-span-2">
                    <Card>
                        <CardHeader className="flex flex-row justify-between items-center">
                            <CardTitle>Item List ({items.length})</CardTitle>
                            {selectedIds.size > 0 && (
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm text-gray-500">{selectedIds.size} selected</span>
                                    <Button size="sm" variant="outline" onClick={() => setShowBulkPrice(true)}>Bulk Price</Button>
                                </div>
                            )}
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
                                                onChange={e => setBulkPriceType(e.target.value as any)}
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
                                            {items.map(item => (
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
                </div>
            </div>
        </div>
    )
}
