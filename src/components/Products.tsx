import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react'
import { supabase } from '../supabaseClient'
import { Button } from './ui/Button'
import { Icons } from './ui/Icons'
import { Input } from './ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'

// We will lazy load the unified form later
const ProductFormWrapper = lazy(() => import('./ProductForm'))
const ItemImportDialog = lazy(() => import('./ItemImportDialog').then(module => ({ default: module.ItemImportDialog })))
const ItemForm = lazy(() => import('./ItemForm'))

type Item = {
    id: string
    sku: string
    name: string
    type: 'FINISHED_GOOD' | 'RAW_MATERIAL' | 'TRADED'
    price_umum: number
    price_khusus: number
    default_price_buy: number
    min_stock: number
    uom_id: string
    size_id: string
    color_id: string
    parent_id?: string
    uom?: { name: string }
    size?: { name: string }
    color?: { name: string }
    is_active: boolean
}

type ProductParent = {
    id: string
    code: string | null
    name: string
    image_url: string | null
    brand?: { name: string }
    category?: { name: string }
    is_active: boolean
    items: { count: number }[] // Aggregate count from relation
    variants?: Item[] // Loaded when expanded
}

type ItemRow = Item & {
    uom?: { name: string }[]
    size?: { name: string }[]
    color?: { name: string }[]
}

type ItemFormItem = Omit<Item, 'uom'> & {
    uom?: string | { name: string; code: string }
}

export default function Products() {
    const [products, setProducts] = useState<ProductParent[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Pagination & Filter
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize] = useState(25)
    const [totalCount, setTotalCount] = useState(0)
    const [searchTerm, setSearchTerm] = useState('')

    // Form State
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [isImportOpen, setIsImportOpen] = useState(false)

    //ExpandableRows & Item Editing
    const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())
    const [editingItemId, setEditingItemId] = useState<string | null>(null)
    const [addingVariantParentId, setAddingVariantParentId] = useState<string | null>(null)
    const [isItemFormOpen, setIsItemFormOpen] = useState(false)

    const fetchProducts = useCallback(async () => {
        setLoading(true)
        setExpandedParents(new Set()) // Clear expanded state on refresh
        try {
            // Fetch parents with count of items
            let query = supabase
                .from('product_parents')
                .select(`
                    id, code, name, image_url, is_active,
                    brand:brands(name),
                    category:categories(name),
                    items:items(count)
                `, { count: 'exact' })

            if (searchTerm) {
                query = query.or(`name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%`)
            }

            const from = (currentPage - 1) * pageSize
            const to = from + pageSize - 1

            const { data, count, error } = await query
                .order('name', { ascending: true })
                .range(from, to)

            if (error) throw error

            const safeData = (data as unknown as ProductParent[]) || []
            setProducts(safeData)
            setTotalCount(count || 0)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
        } finally {
            setLoading(false)
        }
    }, [currentPage, pageSize, searchTerm])

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts()
        }, 500)
        return () => clearTimeout(timer)
    }, [fetchProducts])

    const handleCreate = () => {
        setEditingId(null)
        setIsFormOpen(true)
    }

    const handleEdit = (id: string) => {
        setEditingId(id)
        setIsFormOpen(true)
    }

    const handleFormClose = (shouldRefresh: boolean = false) => {
        setIsFormOpen(false)
        if (shouldRefresh) fetchProducts()
    }

    const toggleExpand = async (parentId: string) => {
        const newExpanded = new Set(expandedParents)

        if (newExpanded.has(parentId)) {
            // Collapse
            newExpanded.delete(parentId)
            setExpandedParents(newExpanded)
        } else {
            // Expand - fetch variants
            newExpanded.add(parentId)
            setExpandedParents(newExpanded)

            // Fetch variants if not already loaded
            const parent = products.find(p => p.id === parentId)
            if (parent && !parent.variants) {
                try {
                    const { data, error } = await supabase
                        .from('items')
                        .select(`
                            id, sku, name, type, price_umum, price_khusus, default_price_buy, min_stock, is_active, parent_id,
                            uom_id, size_id, color_id,
                            uom:uoms(name),
                            size:sizes(name),
                            color:colors(name)
                        `)
                        .eq('parent_id', parentId)
                        .order('sku', { ascending: true })

                    if (error) throw error

                    // Transform Supabase relation arrays to single objects
                    const transformedData = (data as ItemRow[] | null || []).map((item) => ({
                        ...item,
                        uom: item.uom?.[0] || undefined,
                        size: item.size?.[0] || undefined,
                        color: item.color?.[0] || undefined
                    })) as Item[]

                    // Update parent with variants
                    setProducts(prev => prev.map(p =>
                        p.id === parentId ? { ...p, variants: transformedData } : p
                    ))
                } catch (err) {
                    console.error('Error fetching variants:', err)
                }
            }
        }
    }

    const handleEditItem = (itemId: string) => {
        setEditingItemId(itemId)
        setAddingVariantParentId(null)
        setIsItemFormOpen(true)
    }

    const handleAddVariant = (parentId: string) => {
        setEditingItemId(null)
        setAddingVariantParentId(parentId)
        setIsItemFormOpen(true)
    }

    const handleItemFormClose = (shouldRefresh: boolean = false) => {
        setIsItemFormOpen(false)
        setEditingItemId(null)
        setAddingVariantParentId(null)
        if (shouldRefresh) {
            // Refresh variants for expanded parents
            expandedParents.forEach(parentId => {
                toggleExpand(parentId).then(() => toggleExpand(parentId))
            })
            fetchProducts()
        }
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const rawExistingItem = editingItemId
        ? products.reduce<Item | null>(
            (found, p) => found || (p.variants?.find(v => v.id === editingItemId) || null),
            null
        )
        : null
    const existingItemForForm: ItemFormItem | null = rawExistingItem
        ? {
            ...rawExistingItem,
            uom: typeof rawExistingItem.uom === 'string'
                ? rawExistingItem.uom
                : rawExistingItem.uom?.name
        }
        : null

    if (isFormOpen) {
        return (
            <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading form...</p>
                    </div>
                </div>
            }>
                <ProductFormWrapper
                    parentId={editingId}
                    onClose={handleFormClose}
                />
            </Suspense>
        )
    }

    return (
        <div className="w-full space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="hidden md:block text-2xl font-bold tracking-tight">Products</h2>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto">
                    <Button
                        onClick={() => setIsImportOpen(true)}
                        variant="secondary"
                        icon={<Icons.Upload className="w-4 h-4" />}
                        className="w-full sm:w-auto"
                    >
                        Import
                    </Button>
                    <Button
                        onClick={handleCreate}
                        icon={<Icons.Plus className="w-4 h-4" />}
                        className="w-full sm:w-auto"
                    >
                        New Product
                    </Button>
                </div>
            </div>

            {error && <div className="bg-red-100 text-red-700 px-4 py-3 rounded">{error}</div>}

            <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle>Product List ({totalCount})</CardTitle>
                    <div className="w-full sm:w-64">
                        <Input
                            placeholder="Search code or name..."
                            value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Hint for users */}
                    {totalCount > 0 && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2 text-sm">
                            <Icons.Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <span className="text-blue-800">
                                <strong>Tip:</strong> Click any product row to expand and see all variants (SKUs).
                                Click the <Icons.ChevronRight className="w-3 h-3 inline mx-1" /> icon to expand/collapse.
                            </span>
                        </div>
                    )}
                    <div className="overflow-x-auto min-h-[300px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Brand</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-center">Variants</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                                    </TableRow>
                                ) : products.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">No products found.</TableCell>
                                    </TableRow>
                                ) : (
                                    products.map(p => {
                                        const isExpanded = expandedParents.has(p.id)
                                        const variantCount = p.items?.[0]?.count || 0

                                        return (
                                            <React.Fragment key={p.id}>
                                                {/* Parent Row */}
                                                <TableRow className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(p.id)}>
                                                    <TableCell className="font-mono text-xs">
                                                        <div className="flex items-center gap-2">
                                                            {variantCount > 0 && (
                                                                isExpanded ?
                                                                    <Icons.ChevronDown className="w-4 h-4 text-gray-500" /> :
                                                                    <Icons.ChevronRight className="w-4 h-4 text-gray-500" />
                                                            )}
                                                            {p.code || '-'}
                                                        </div>
                                                    </TableCell>
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
                                                    <TableCell>{p.brand?.name || '-'}</TableCell>
                                                    <TableCell>{p.category?.name || '-'}</TableCell>
                                                    <TableCell className="text-center">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                            {variantCount}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {p.is_active
                                                            ? <span className="text-green-600 font-bold text-xs">Active</span>
                                                            : <span className="text-gray-400 font-bold text-xs">Inactive</span>
                                                        }
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                                                            <Button size="sm" variant="secondary" onClick={() => handleAddVariant(p.id)}>
                                                                <Icons.Plus className="w-3 h-3" />
                                                            </Button>
                                                            <Button size="sm" variant="secondary" onClick={() => handleEdit(p.id)}>Edit All</Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>

                                                {/* Variant Rows (Expanded) */}
                                                {isExpanded && p.variants && p.variants.length > 0 && p.variants.map(variant => (
                                                    <TableRow key={variant.id} className="bg-gray-50/50">
                                                        <TableCell className="pl-12 font-mono text-xs text-gray-600">{variant.sku}</TableCell>
                                                        <TableCell className="text-sm text-gray-700">{variant.name}</TableCell>
                                                        <TableCell className="text-xs text-gray-500">
                                                            {[variant.size?.name, variant.color?.name, variant.uom?.name]
                                                                .filter(Boolean)
                                                                .join(' / ') || '-'}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-gray-500">
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${variant.type === 'FINISHED_GOOD' ? 'bg-green-100 text-green-700' :
                                                                variant.type === 'RAW_MATERIAL' ? 'bg-orange-100 text-orange-700' :
                                                                    'bg-purple-100 text-purple-700'
                                                                }`}>
                                                                {variant.type}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-xs text-gray-600 text-right">
                                                            Rp {variant.price_umum?.toLocaleString('id-ID')}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {variant.is_active ?
                                                                <Icons.Check className="w-4 h-4 text-green-600 mx-auto" /> :
                                                                <Icons.Close className="w-4 h-4 text-gray-400 mx-auto" />
                                                            }
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleEditItem(variant.id)}
                                                            >
                                                                Edit
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}

                                                {/* No Variants Message */}
                                                {isExpanded && (!p.variants || p.variants.length === 0) && (
                                                    <TableRow className="bg-gray-50/50">
                                                        <TableCell colSpan={7} className="text-center py-4 text-sm text-gray-500">
                                                            No variants yet. Click "+ Add Variant" to create one.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between py-4 border-t mt-4 text-xs text-gray-500">
                        <div>
                            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} entries
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1 || loading}
                            >
                                Previous
                            </Button>
                            <div className="px-2 text-sm font-medium">
                                Page {currentPage} of {totalPages}
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages || loading}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Import Dialog */}
            {isImportOpen && (
                <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center">Loading...</div>}>
                    <ItemImportDialog
                        isOpen={isImportOpen}
                        onClose={() => setIsImportOpen(false)}
                        onSuccess={() => {
                            setIsImportOpen(false)
                            fetchProducts()
                        }}
                    />
                </Suspense>
            )}

            {/* Item Edit/Add Dialog */}
            {isItemFormOpen && (
                <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center">Loading...</div>}>
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 sm:p-6">
                        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                            <div className="flex justify-between items-center px-6 py-4 border-b shrink-0">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {editingItemId ? 'Edit Variant Item' : 'Add New Variant'}
                                </h3>
                                <button
                                    onClick={() => handleItemFormClose(false)}
                                    className="text-gray-400 hover:text-gray-500 transition-colors"
                                >
                                    <Icons.Close className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto">
                                <ItemForm
                                    existingItem={
                                        existingItemForForm
                                    }
                                    initialParentId={addingVariantParentId || undefined}
                                    onSuccess={() => handleItemFormClose(true)}
                                    onCancel={() => handleItemFormClose(false)}
                                />
                            </div>
                        </div>
                    </div>
                </Suspense>
            )}
        </div>
    )
}
