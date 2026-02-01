import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Button } from './ui/Button'
import { Icons } from './ui/Icons'
import { Input } from './ui/Input'

import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { ImageUpload } from './ui/ImageUpload'
import { Textarea } from './ui/Textarea'

type ProductParent = {
    id: string
    code: string | null
    name: string
    brand_id: string | null
    category_id: string | null
    image_url: string | null
    description: string | null
    is_active: boolean
}

type Variant = {
    id?: string
    sku: string
    name: string
    type: 'FINISHED_GOOD' | 'RAW_MATERIAL' | 'TRADED'
    uom_id: string
    size_id: string
    color_id: string
    price_umum: number
    price_khusus: number
    default_price_buy: number
    min_stock: number
    is_active: boolean
    tempId?: string // For new rows mainly
}

import { QuickMasterDialog } from './QuickMasterDialog'

interface ProductFormProps {
    parentId: string | null
    onClose: (shouldRefresh: boolean) => void
}

export default function ProductForm({ parentId, onClose }: ProductFormProps) {
    // Parent State
    const [parent, setParent] = useState<Partial<ProductParent>>({
        name: '', code: '', image_url: '', description: '', is_active: true
    })

    // Variants State
    const [variants, setVariants] = useState<Variant[]>([])

    // Master Data for Selects
    const [brands, setBrands] = useState<{ id: string, name: string }[]>([])
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([])
    const [uoms, setUoms] = useState<{ id: string, name: string }[]>([])
    const [sizes, setSizes] = useState<{ id: string, name: string }[]>([])
    const [colors, setColors] = useState<{ id: string, name: string }[]>([])

    // Quick Add Dialog State
    const [quickDialog, setQuickDialog] = useState<{ type: 'brands' | 'categories' | 'uoms' | 'sizes' | 'colors', title: string } | null>(null)

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadMasterData()
        if (parentId) {
            loadProduct(parentId)
        } else {
            // Init with one empty variant row
            handleAddVariant()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [parentId])

    async function loadMasterData() {
        const [b, c, u, s, col] = await Promise.all([
            supabase.from('brands').select('id, name').order('name'),
            supabase.from('categories').select('id, name').order('name'),
            supabase.from('uoms').select('id, name').order('name'),
            supabase.from('sizes').select('id, name').order('name'),
            supabase.from('colors').select('id, name').order('name')
        ])
        if (b.data) setBrands(b.data)
        if (c.data) setCategories(c.data)
        if (u.data) setUoms(u.data)
        if (s.data) setSizes(s.data)
        if (col.data) setColors(col.data)
    }

    async function loadProduct(id: string) {
        setLoading(true)
        try {
            // Get Parent
            const { data: pData, error: pError } = await supabase
                .from('product_parents')
                .select('*')
                .eq('id', id)
                .single()
            if (pError) throw pError
            setParent(pData)

            // Get Variants
            const { data: vData, error: vError } = await supabase
                .from('items')
                .select('*')
                .eq('parent_id', id)
                .order('sku')

            if (vError) throw vError

            // Map to Variant type
            // Map to Variant type
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mapped: Variant[] = vData.map((d: any) => ({
                id: d.id,
                sku: d.sku,
                name: d.name,
                type: d.type,
                uom_id: d.uom_id,
                size_id: d.size_id,
                color_id: d.color_id,
                price_umum: d.price_umum,
                price_khusus: d.price_khusus,
                default_price_buy: d.default_price_buy,
                min_stock: d.min_stock,
                is_active: d.is_active
            }))
            setVariants(mapped)
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message)
            else setError("Unknown error")
        } finally {
            setLoading(false)
        }
    }

    const handleAddVariant = useCallback(() => {
        // Default values
        // UUID fallback for older mobile browsers
        const tempId = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
            })
        setVariants(prev => [...prev, {
            tempId,
            sku: '',
            name: parent.name ? `${parent.name} - New` : '',
            type: 'FINISHED_GOOD',
            uom_id: uoms.find(u => u.name === 'PCS')?.id || '', // Default PCS
            size_id: '',
            color_id: '',
            price_umum: 0,
            price_khusus: 0,
            default_price_buy: 0,
            min_stock: 0,
            is_active: true
        }])
    }, [parent.name, uoms])


    const handleVariantChange = (index: number, field: keyof Variant, value: string | number | boolean) => {
        const newVariants = [...variants]
        newVariants[index] = { ...newVariants[index], [field]: value }
        setVariants(newVariants)
    }

    const handleRemoveVariant = (index: number) => {
        const newVariants = [...variants]
        // If it's an existing item (has id), we might want to track deletion or just prevent it in this MVP
        // For now, let's just remove from UI list. 
        // NOTE: The RPC logic currently does NOT delete items missing from the list for safety. 
        // User has to Deactivate. 
        // But for new rows (tempId), we can just remove.
        newVariants.splice(index, 1)
        setVariants(newVariants)
    }

    const handleGenerateName = (index: number) => {
        const v = variants[index]
        const sizeName = sizes.find(s => s.id === v.size_id)?.name || ''
        const colorName = colors.find(c => c.id === v.color_id)?.name || ''

        let newName = parent.name || ''
        if (sizeName) newName += ` ${sizeName}`
        if (colorName) newName += ` ${colorName}`

        handleVariantChange(index, 'name', newName)

        // Auto SKU suggestion (Basic)
        if (!v.sku && parent.code) {
            const newSku = `${parent.code}-${sizeName.substring(0, 2).toUpperCase()}-${colorName.substring(0, 3).toUpperCase()}`.replace(/\s/g, '')
            handleVariantChange(index, 'sku', newSku)
        }
    }

    const handleSave = async () => {
        if (!parent.name) {
            setError("Product Name is required")
            return
        }
        if (variants.length === 0) {
            setError("At least one variant is required")
            return
        }

        setSaving(true)
        setError(null)
        try {
            const payload = {
                p_parent_id: parentId,
                p_parent_code: parent.code,
                p_parent_name: parent.name,
                p_brand_id: parent.brand_id || null,
                p_category_id: parent.category_id || null,
                p_image_url: parent.image_url || null,
                p_description: parent.description || null,
                p_variants: variants.map(v => ({
                    id: v.id || null, // null for new
                    sku: v.sku,
                    name: v.name,
                    type: v.type,
                    uom_id: v.uom_id || null,
                    size_id: v.size_id || null,
                    color_id: v.color_id || null,
                    price_umum: v.price_umum,
                    price_khusus: v.price_khusus,
                    default_price_buy: v.default_price_buy,
                    min_stock: v.min_stock,
                    is_active: v.is_active
                }))
            }

            const { error } = await supabase.rpc('rpc_save_product_complete', payload)
            if (error) throw error

            onClose(true)
        } catch (err: unknown) {
            console.error(err)
            if (err instanceof Error) setError(err.message)
            else setError("Failed to save product")
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="p-8 text-center">Loading product data...</div>

    return (
        <div className="flex flex-col h-full bg-gray-50 -m-4 sm:-m-8 p-4 sm:p-8 overflow-hidden">
            {/* Header / Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">
                        {parentId ? 'Edit Product' : 'Create New Product'}
                    </h2>
                    <p className="hidden md:block text-gray-500 text-sm">Manage Product Info & Variants</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto">
                    <Button variant="secondary" onClick={() => onClose(false)} className="w-full sm:w-auto">Cancel</Button>
                    <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                        {saving ? 'Saving...' : 'Save Product'}
                    </Button>
                </div>
            </div>

            {error && <div className="bg-red-100 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

            <div className="flex-1 overflow-y-auto space-y-6 pb-20">
                {/* 1. PARENT INFO */}
                <Card>
                    <CardHeader>
                        <CardTitle>Product Information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Product Name *</label>
                            <Input
                                value={parent.name || ''}
                                onChange={e => setParent({ ...parent, name: e.target.value })}
                                placeholder="e.g. Kaos Polos Cotton 30s"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Product Code / Model</label>
                            <Input
                                value={parent.code || ''}
                                onChange={e => setParent({ ...parent, code: e.target.value })}
                                placeholder="e.g. KP-30S"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Brand</label>
                            <div className="flex gap-2">
                                <select
                                    className="w-full border rounded p-2 text-sm bg-white"
                                    value={parent.brand_id || ''}
                                    onChange={e => setParent({ ...parent, brand_id: e.target.value || null })}
                                >
                                    <option value="">- Select Brand -</option>
                                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setQuickDialog({ type: 'brands', title: 'Brand' })}
                                    icon={<Icons.Plus className="w-4 h-4" />}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Category</label>
                            <div className="flex gap-2">
                                <select
                                    className="w-full border rounded p-2 text-sm bg-white"
                                    value={parent.category_id || ''}
                                    onChange={e => setParent({ ...parent, category_id: e.target.value || null })}
                                >
                                    <option value="">- Select Category -</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setQuickDialog({ type: 'categories', title: 'Category' })}
                                    icon={<Icons.Plus className="w-4 h-4" />}
                                />
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <ImageUpload
                                value={parent.image_url || ''}
                                onChange={(url) => setParent({ ...parent, image_url: url })}
                                folder="product-parents"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <Textarea
                                label="Description"
                                value={parent.description || ''}
                                onChange={e => setParent({ ...parent, description: e.target.value })}
                                placeholder="Deskripsi produk (opsional)"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* 2. VARIANTS */}
                <Card>
                    <CardHeader className="flex flex-row justify-between items-center">
                        <CardTitle>Variants ({variants.length})</CardTitle>
                        <Button size="sm" variant="outline" onClick={handleAddVariant} icon={<Icons.Plus className="w-3 h-3" />}>
                            Add Variant
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[180px]">SKU *</TableHead>
                                        <TableHead className="w-[250px]">Variant Name *</TableHead>
                                        <TableHead className="w-[120px]">Type</TableHead>
                                        <TableHead className="w-[100px]">
                                            <div className="flex items-center gap-1">
                                                UoM
                                                <button type="button" onClick={() => setQuickDialog({ type: 'uoms', title: 'UoM' })} className="text-blue-600 hover:bg-blue-50 rounded p-0.5"><Icons.Plus className="w-3 h-3" /></button>
                                            </div>
                                        </TableHead>
                                        <TableHead className="w-[100px]">
                                            <div className="flex items-center gap-1">
                                                Size
                                                <button type="button" onClick={() => setQuickDialog({ type: 'sizes', title: 'Size' })} className="text-blue-600 hover:bg-blue-50 rounded p-0.5"><Icons.Plus className="w-3 h-3" /></button>
                                            </div>
                                        </TableHead>
                                        <TableHead className="w-[100px]">
                                            <div className="flex items-center gap-1">
                                                Color
                                                <button type="button" onClick={() => setQuickDialog({ type: 'colors', title: 'Color' })} className="text-blue-600 hover:bg-blue-50 rounded p-0.5"><Icons.Plus className="w-3 h-3" /></button>
                                            </div>
                                        </TableHead>
                                        <TableHead className="w-[120px]">Price (Umum)</TableHead>
                                        <TableHead className="w-[120px]">Price (Khusus)</TableHead>
                                        <TableHead className="w-[120px]">Cost (Buy)</TableHead>
                                        <TableHead className="w-[100px]">Min Stock</TableHead>
                                        <TableHead className="w-[50px]"><span className="sr-only">Actions</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {variants.map((variant, idx) => (
                                        <TableRow key={variant.id || variant.tempId}>
                                            <TableCell>
                                                <Input
                                                    value={variant.sku}
                                                    onChange={e => handleVariantChange(idx, 'sku', e.target.value)}
                                                    placeholder="SKU"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    <Input
                                                        value={variant.name}
                                                        onChange={e => handleVariantChange(idx, 'name', e.target.value)}
                                                        className="flex-1"
                                                    />
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        className="px-2"
                                                        title="Auto Generate Name"
                                                        onClick={() => handleGenerateName(idx)}
                                                    >
                                                        <Icons.Refresh className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <select
                                                    className="w-full border rounded p-1 text-xs"
                                                    value={variant.type}
                                                    onChange={e => handleVariantChange(idx, 'type', e.target.value)}
                                                >
                                                    <option value="FINISHED_GOOD">Product</option>
                                                    <option value="RAW_MATERIAL">Material</option>
                                                    <option value="TRADED">Traded</option>
                                                </select>
                                            </TableCell>
                                            <TableCell>
                                                <select
                                                    className="w-full border rounded p-1 text-xs"
                                                    value={variant.uom_id}
                                                    onChange={e => handleVariantChange(idx, 'uom_id', e.target.value)}
                                                >
                                                    <option value="">-</option>
                                                    {uoms.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                </select>
                                            </TableCell>
                                            <TableCell>
                                                <select
                                                    className="w-full border rounded p-1 text-xs"
                                                    value={variant.size_id}
                                                    onChange={e => handleVariantChange(idx, 'size_id', e.target.value)}
                                                >
                                                    <option value="">-</option>
                                                    {sizes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </TableCell>
                                            <TableCell>
                                                <select
                                                    className="w-full border rounded p-1 text-xs"
                                                    value={variant.color_id}
                                                    onChange={e => handleVariantChange(idx, 'color_id', e.target.value)}
                                                >
                                                    <option value="">-</option>
                                                    {colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    value={variant.price_umum}
                                                    onChange={e => handleVariantChange(idx, 'price_umum', parseFloat(e.target.value))}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    value={variant.price_khusus || 0}
                                                    onChange={e => handleVariantChange(idx, 'price_khusus', parseFloat(e.target.value))}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    value={variant.default_price_buy || 0}
                                                    onChange={e => handleVariantChange(idx, 'default_price_buy', parseFloat(e.target.value))}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={variant.min_stock}
                                                    onChange={e => handleVariantChange(idx, 'min_stock', parseFloat(e.target.value) || 0)}
                                                    placeholder="0"
                                                    className="w-full"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-500 hover:text-red-700"
                                                    onClick={() => handleRemoveVariant(idx)}
                                                >
                                                    <Icons.Trash className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="mt-4 text-xs text-gray-500">
                            * Min Stock is a threshold for low stock alerts. Actual inventory is managed via Purchase/Sales/Adjustment.
                        </div>
                    </CardContent>
                </Card>
            </div>

            {quickDialog && (
                <QuickMasterDialog
                    isOpen={!!quickDialog}
                    table={quickDialog.type}
                    title={quickDialog.title}
                    onClose={() => setQuickDialog(null)}
                    onSuccess={() => loadMasterData()}
                />
            )}
        </div>
    )
}
