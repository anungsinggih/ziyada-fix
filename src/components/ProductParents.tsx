import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Icons } from './ui/Icons'
import { Select } from './ui/Select'
import { Textarea } from './ui/Textarea'
import { Checkbox } from './ui/Checkbox'
import { ImageUpload } from './ui/ImageUpload'
import { QuickMasterDialog } from './QuickMasterDialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog'
import ItemForm from './ItemForm'

type MasterItem = {
    id: string
    name: string
    code?: string
    sort_order?: number
    is_active: boolean
}

type ParentProduct = {
    id: string
    code: string | null
    name: string
    brand_id: string | null
    category_id: string | null
    image_url: string | null
    description: string | null
    is_active: boolean
    brand?: { name: string }
    category?: { name: string }
}

type Item = {
    id: string
    sku: string
    name: string
    size?: { name: string }
    color?: { name: string }
    price_umum: number
    min_stock: number
}

export default function ProductParents() {
    const [parents, setParents] = useState<ParentProduct[]>([])
    const [brands, setBrands] = useState<MasterItem[]>([])
    const [categories, setCategories] = useState<MasterItem[]>([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    const filteredParents = parents.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.brand?.name && p.brand.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.category?.name && p.category.name.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const [form, setForm] = useState({
        id: '',
        code: '',
        name: '',
        brand_id: '',
        category_id: '',
        image_url: '',
        description: '',
        is_active: true
    })

    // Drill down state
    const [expandedParentId, setExpandedParentId] = useState<string | null>(null)
    const [parentItems, setParentItems] = useState<Item[]>([])
    const [loadingItems, setLoadingItems] = useState(false)

    // Modals
    const [quickDialog, setQuickDialog] = useState<{ type: 'brands' | 'categories', title: string } | null>(null)
    const [isItemModalOpen, setIsItemModalOpen] = useState(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [editingItem, setEditingItem] = useState<any | null>(null) // Passing full item obj to form

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setLoading(true)
        const [pRes, bRes, cRes] = await Promise.all([
            supabase.from('product_parents').select('*, brand:brands(name), category:categories(name)').order('name'),
            supabase.from('brands').select('*').eq('is_active', true),
            supabase.from('categories').select('*').eq('is_active', true)
        ])
        setParents(pRes.data || [])
        setBrands(bRes.data || [])
        setCategories(cRes.data || [])
        setLoading(false)
    }

    async function fetchParentItems(parentId: string) {
        setLoadingItems(true)
        const { data } = await supabase
            .from('items')
            .select('id, sku, name, size:sizes(name), color:colors(name), price_umum, min_stock')
            .eq('parent_id', parentId)
            .order('sku')

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setParentItems(data as any[] || [])
        setLoadingItems(false)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const payload = {
            code: form.code || null,
            name: form.name,
            brand_id: form.brand_id || null,
            category_id: form.category_id || null,
            image_url: form.image_url || null,
            description: form.description || null,
            is_active: form.is_active
        }

        try {
            if (form.id) {
                const { error } = await supabase.from('product_parents').update(payload).eq('id', form.id)
                if (error) throw error
            } else {
                const { error } = await supabase.from('product_parents').insert([payload])
                if (error) throw error
            }
            resetForm()
            fetchData()
        } catch (err: unknown) {
            if (err instanceof Error) alert(err.message)
            else alert('An unknown error occurred')
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Delete parent?")) return
        await supabase.from('product_parents').delete().eq('id', id)
        fetchData()
    }

    function resetForm() {
        setForm({
            id: '',
            code: '',
            name: '',
            brand_id: '',
            category_id: '',
            image_url: '',
            description: '',
            is_active: true
        })
    }

    function handleExpand(id: string) {
        if (expandedParentId === id) {
            setExpandedParentId(null)
            setParentItems([])
        } else {
            setExpandedParentId(id)
            fetchParentItems(id)
        }
    }

    function handleAddItem() {
        setEditingItem(null)
        setIsItemModalOpen(true)
    }

    function handleEditItem(item: Item) {
        setEditingItem(item)
        setIsItemModalOpen(true)
    }

    function handleItemSuccess() {
        setIsItemModalOpen(false)
        if (expandedParentId) fetchParentItems(expandedParentId)
    }

    const [isParentModalOpen, setIsParentModalOpen] = useState(false)

    function handleAddParent() {
        resetForm()
        setIsParentModalOpen(true)
    }

    function handleEdit(p: ParentProduct) {
        setForm({
            id: p.id,
            code: p.code || '',
            name: p.name,
            brand_id: p.brand_id || '',
            category_id: p.category_id || '',
            image_url: p.image_url || '',
            description: p.description || '',
            is_active: p.is_active
        })
        setIsParentModalOpen(true)
    }

    function handleParentSuccess() {
        setIsParentModalOpen(false)
        fetchData()
    }

    return (
        <div className="w-full space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Product Parents</h2>
                <Button onClick={handleAddParent} icon={<Icons.Plus className="w-4 h-4" />}>Add Parent</Button>
            </div>

            {/* List Section Only */}
            <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle>Product Parents List</CardTitle>
                    <div className="flex items-center gap-2">
                        {loading && <span className="text-xs font-normal text-gray-500 animate-pulse">Syncing...</span>}
                        <div className="w-40">
                            <Input
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="h-8 text-xs mb-0"
                                containerClassName="mb-0"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-auto max-h-[600px]">
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeader className="w-8"><span className="sr-only">Expand</span></TableHeader>
                                    <TableHeader className="whitespace-nowrap">Code</TableHeader>
                                    <TableHeader className="whitespace-nowrap">Name</TableHeader>
                                    <TableHeader className="whitespace-nowrap">Brand/Cat</TableHeader>
                                    <TableHeader className="whitespace-nowrap">Active</TableHeader>
                                    <TableHeader className="whitespace-nowrap">Actions</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredParents.map(p => (
                                    <>
                                        <TableRow key={p.id} className={expandedParentId === p.id ? 'bg-blue-50' : ''}>
                                            <TableCell>
                                                <button onClick={() => handleExpand(p.id)} className="p-1 hover:bg-gray-200 rounded">
                                                    {expandedParentId === p.id ? <Icons.ChevronDown className="w-4 h-4" /> : <Icons.ChevronRight className="w-4 h-4" />}
                                                </button>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{p.code || '-'}</TableCell>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-3">
                                                    {p.image_url ? (
                                                        <a href={p.image_url} target="_blank" rel="noreferrer" className="shrink-0">
                                                            <img src={p.image_url} alt={p.name} className="w-10 h-10 object-cover rounded border bg-slate-50" />
                                                        </a>
                                                    ) : (
                                                        <div className="w-10 h-10 bg-slate-100 rounded border flex items-center justify-center text-slate-300">
                                                            <Icons.Image className="w-5 h-5" />
                                                        </div>
                                                    )}
                                                    <span>{p.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-xs">{p.brand?.name}</div>
                                                <div className="text-xs text-gray-500">{p.category?.name}</div>
                                            </TableCell>
                                            <TableCell>
                                                {p.is_active ? <span className="text-green-600 font-bold text-xs">Yes</span> : <span className="text-gray-400 text-xs">No</span>}
                                            </TableCell>
                                            <TableCell className="flex gap-2">
                                                <button onClick={() => handleEdit(p)} className="text-blue-600"><Icons.Edit className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(p.id)} className="text-red-600"><Icons.Trash className="w-4 h-4" /></button>
                                            </TableCell>
                                        </TableRow>
                                        {expandedParentId === p.id && (
                                            <TableRow className="bg-gray-50">
                                                <TableCell colSpan={6} className="p-4">
                                                    <div className="pl-8">
                                                        <div className="flex justify-between items-center mb-3">
                                                            <h4 className="font-semibold text-sm text-gray-700">Variants (Items)</h4>
                                                            <Button size="sm" onClick={handleAddItem} icon={<Icons.Plus className="w-3 h-3" />}>Add Variant</Button>
                                                        </div>
                                                        {loadingItems ? <div className="text-sm text-gray-500">Loading variants...</div> : (
                                                            parentItems.length > 0 ? (
                                                                <table className="w-full text-sm">
                                                                    <thead>
                                                                        <tr className="text-left text-gray-500 border-b">
                                                                            <th className="pb-2">SKU</th>
                                                                            <th className="pb-2">Name</th>
                                                                            <th className="pb-2">Size/Color</th>
                                                                            <th className="pb-2 text-right">Price</th>
                                                                            <th className="pb-2 text-right">Stock</th>
                                                                            <th className="pb-2"></th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {parentItems.map(item => (
                                                                            <tr key={item.id} className="border-b last:border-0 hover:bg-gray-100">
                                                                                <td className="py-2 font-mono text-xs">{item.sku}</td>
                                                                                <td className="py-2">{item.name}</td>
                                                                                <td className="py-2 text-xs">
                                                                                    {item.size?.name} / {item.color?.name}
                                                                                </td>
                                                                                <td className="py-2 text-right">{item.price_umum.toLocaleString()}</td>
                                                                                <td className="py-2 text-right">{item.min_stock}</td>
                                                                                <td className="py-2 text-right">
                                                                                    <button onClick={() => handleEditItem(item)} className="text-blue-600 text-xs hover:underline">Edit</button>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            ) : <div className="text-sm text-gray-400 italic">No variants yet.</div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Parent Form Modal */}
            <Dialog isOpen={isParentModalOpen} onClose={() => setIsParentModalOpen(false)}>
                <DialogHeader>
                    <DialogTitle>{form.id ? 'Edit Parent Product' : 'New Parent Product'}</DialogTitle>
                </DialogHeader>
                <DialogContent>
                    <form onSubmit={(e) => { handleSubmit(e); handleParentSuccess(); }} className="space-y-4">
                        <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-1">
                                <Input label="Code" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Ex: P-001" />
                            </div>
                            <div className="col-span-2">
                                <Input label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                            </div>
                        </div>

                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <Select
                                    label="Brand"
                                    value={form.brand_id}
                                    onChange={(e) => setForm({ ...form, brand_id: e.target.value })}
                                    options={[{ label: '-- None --', value: '' }, ...brands.map(b => ({ label: b.name, value: b.id }))]}
                                />
                            </div>
                            <Button type="button" icon={<Icons.Plus className="w-4 h-4" />} onClick={() => setQuickDialog({ type: 'brands', title: 'Brand' })} className="mb-px" />
                        </div>

                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <Select
                                    label="Category"
                                    value={form.category_id}
                                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                                    options={[{ label: '-- None --', value: '' }, ...categories.map(c => ({ label: c.name, value: c.id }))]}
                                />
                            </div>
                            <Button type="button" icon={<Icons.Plus className="w-4 h-4" />} onClick={() => setQuickDialog({ type: 'categories', title: 'Category' })} className="mb-px" />
                        </div>

                        <ImageUpload
                            value={form.image_url}
                            onChange={(url) => setForm({ ...form, image_url: url })}
                            folder="product-parents"
                        />

                        <Textarea label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

                        <Checkbox label="Active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />

                        <div className="flex gap-2 pt-2">
                            <Button type="submit" className="w-full">{form.id ? 'Update' : 'Add'}</Button>
                            <Button type="button" variant="secondary" onClick={() => setIsParentModalOpen(false)} className="w-full">Cancel</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Quick Add Modals */}
            {quickDialog && (
                <QuickMasterDialog
                    isOpen={!!quickDialog}
                    table={quickDialog.type}
                    title={quickDialog.title}
                    onClose={() => setQuickDialog(null)}
                    onSuccess={() => fetchData()}
                />
            )}

            {/* New/Edit Item Modal */}
            <Dialog isOpen={isItemModalOpen} onClose={() => setIsItemModalOpen(false)}>
                <DialogHeader>
                    <DialogTitle>{editingItem ? 'Edit Variant' : 'New Variant'}</DialogTitle>
                </DialogHeader>
                <DialogContent>
                    <ItemForm
                        existingItem={editingItem}
                        initialParentId={expandedParentId || undefined}
                        onSuccess={handleItemSuccess}
                        onCancel={() => setIsItemModalOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}
