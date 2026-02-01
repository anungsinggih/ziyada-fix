import { useState } from 'react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Icons } from './ui/Icons'

export type Item = {
    id: string
    sku: string
    name: string
    type: 'FINISHED_GOOD' | 'RAW_MATERIAL' | 'TRADED'
    uom_id: string
    size_id: string
    color_id: string
    parent_id?: string
    price_umum: number
    price_khusus: number
    default_price_buy: number
    min_stock: number
    is_active: boolean
    uom?: { name: string, code: string }
    size?: { name: string, code: string }
    color?: { name: string, code: string }
    parent?: { name: string }
}

interface ItemListProps {
    items: Item[]
    loading: boolean
    totalCount: number
    currentPage: number
    pageSize: number
    onPageChange: (page: number) => void
    searchTerm: string
    onSearchChange: (value: string) => void
    typeFilter: 'all' | 'FINISHED_GOOD' | 'RAW_MATERIAL' | 'TRADED'
    onTypeFilterChange: (value: 'all' | 'FINISHED_GOOD' | 'RAW_MATERIAL' | 'TRADED') => void
    onEdit: (item: Item) => void
    onDelete: (id: string) => void
    onBulkUpdate: (ids: string[], field: 'price_umum' | 'price_khusus' | 'default_price_buy', value: number) => Promise<void>
}

export default function ItemList({
    items,
    loading,
    totalCount,
    currentPage,
    pageSize,
    onPageChange,
    searchTerm,
    onSearchChange,
    typeFilter,
    onTypeFilterChange,
    onEdit,
    onDelete,
    onBulkUpdate,
}: ItemListProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [showBulkPrice, setShowBulkPrice] = useState(false)
    const [bulkPriceType, setBulkPriceType] = useState<'price_umum' | 'price_khusus' | 'default_price_buy'>('price_umum')
    const [bulkPriceValue, setBulkPriceValue] = useState(0)

    function toggleSelection(id: string) {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedIds(newSet)
    }

    async function handleBulkSubmit() {
        if (selectedIds.size === 0) return
        if (bulkPriceValue < 0) {
            alert("Price must be >= 0")
            return
        }
        await onBulkUpdate(Array.from(selectedIds), bulkPriceType, bulkPriceValue)
        setShowBulkPrice(false)
        setSelectedIds(new Set())
        setBulkPriceValue(0)
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    return (
        <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Item List ({totalCount})</CardTitle>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto">
                        <div className="w-full sm:w-40">
                            <Input
                                placeholder="Search items..."
                                value={searchTerm}
                                onChange={e => onSearchChange(e.target.value)}
                                className="h-8 text-xs mb-0"
                                containerClassName="mb-0"
                            />
                        </div>
                        <div className="w-full sm:w-36">
                            <Select
                                value={typeFilter}
                                onChange={e => onTypeFilterChange(e.target.value as typeof typeFilter)}
                                options={[
                                    { label: 'All Types', value: 'all' },
                                    { label: 'Finished', value: 'FINISHED_GOOD' },
                                    { label: 'Raw Material', value: 'RAW_MATERIAL' },
                                    { label: 'Traded', value: 'TRADED' }
                                ]}
                            />
                        </div>
                    </div>
                    {selectedIds.size > 0 && (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                                <Button size="sm" onClick={handleBulkSubmit}>Apply</Button>
                                <Button size="sm" variant="secondary" onClick={() => setShowBulkPrice(false)}>Cancel</Button>
                            </div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <p className="text-center py-8 text-gray-500">Loading...</p>
                ) : (
                    <>
                        <div className="overflow-x-auto min-h-[300px]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10">
                                            <input type="checkbox" disabled />
                                        </TableHead>
                                        <TableHead>SKU</TableHead>
                                        <TableHead>Name / Variant</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Price</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                                No items found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        items.map(item => (
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
                                                    <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold ${item.type === 'FINISHED_GOOD' ? 'bg-green-100 text-green-800' :
                                                        item.type === 'TRADED' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-yellow-100 text-yellow-800'
                                                        }`}>
                                                        {item.type === 'FINISHED_GOOD' ? 'FG' : item.type === 'TRADED' ? 'TRADED' : 'RM'}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm">{item.price_umum.toLocaleString()}</div>
                                                </TableCell>
                                                <TableCell>
                                                    {item.is_active ? <span className="text-green-600 font-bold text-xs">Active</span> : <span className="text-gray-400 font-bold text-xs">Inactive</span>}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex space-x-1">
                                                        <Button size="sm" variant="secondary" onClick={() => onEdit(item)} icon={<Icons.Edit className="w-4 h-4" />} />
                                                        <Button size="sm" variant="danger" onClick={() => onDelete(item.id)} icon={<Icons.Trash className="w-4 h-4" />} />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex items-center justify-between py-4 border-t mt-4 text-xs text-gray-500">
                            <div>
                                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} entries
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
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
                                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage === totalPages || loading}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}
