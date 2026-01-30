
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Checkbox } from './ui/Checkbox'
import { Icons } from './ui/Icons'
import { QuickMasterDialog } from './QuickMasterDialog'

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
    uom?: string | { name: string, code: string } // Legacy or Relation
}

type MasterData = {
    id: string
    code?: string
    name: string
}

interface ItemFormProps {
    existingItem?: Item | null
    initialParentId?: string
    onSuccess: () => void
    onCancel: () => void
}

export default function ItemForm({ existingItem, initialParentId, onSuccess, onCancel }: ItemFormProps) {
    const [uoms, setUoms] = useState<MasterData[]>([])
    const [sizes, setSizes] = useState<MasterData[]>([])
    const [colors, setColors] = useState<MasterData[]>([])
    const [parents, setParents] = useState<MasterData[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [formData, setFormData] = useState<Partial<Item>>({
        sku: '', name: '', type: 'FINISHED_GOOD',
        price_umum: 0, price_khusus: 0, default_price_buy: 0,
        min_stock: 0, is_active: true,
        parent_id: initialParentId
    })

    // Quick Add State
    const [quickDialog, setQuickDialog] = useState<{ type: 'uoms' | 'sizes' | 'colors' | 'product_parents', title: string } | null>(null)

    useEffect(() => {
        fetchMasterData()
    }, [])

    useEffect(() => {
        if (existingItem) {
            setFormData({
                ...existingItem,
                parent_id: existingItem.parent_id || undefined
            })
        } else if (uoms.length > 0) {
            // Set defaults for new item
            setFormData(prev => ({
                ...prev,
                uom_id: prev.uom_id || uoms.find(u => u.code === 'PCS')?.id || uoms[0].id,
                size_id: prev.size_id || sizes.find(s => s.code === 'ALL')?.id || sizes[0]?.id,
                color_id: prev.color_id || colors.find(c => c.code === 'NA')?.id || colors[0]?.id,
                parent_id: initialParentId || prev.parent_id
            }))
        }
    }, [existingItem, uoms, sizes, colors, initialParentId])

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

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            if ((formData.price_umum ?? 0) < 0 || (formData.price_khusus ?? 0) < 0 || (formData.default_price_buy ?? 0) < 0) {
                throw new Error("Prices must be >= 0")
            }

            const selectedUom = uoms.find(u => u.id === formData.uom_id)
            const payload = {
                sku: formData.sku,
                name: formData.name,
                type: formData.type,
                uom_id: formData.uom_id,
                size_id: formData.size_id,
                color_id: formData.color_id,
                parent_id: formData.parent_id || null,
                price_umum: formData.price_umum,
                price_khusus: formData.price_khusus,
                default_price_buy: formData.default_price_buy,
                min_stock: formData.min_stock,
                is_active: formData.is_active,
                uom: selectedUom?.code || 'PCS'
            }

            if (existingItem?.id) {
                const { error } = await supabase.from('items').update(payload).eq('id', existingItem.id)
                if (error) throw error
            } else {
                const { error } = await supabase.from('items').insert([payload])
                if (error) throw error
            }

            onSuccess()
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message)
            else setError('Unknown error')
        } finally {
            setLoading(false)
        }
    }

    function handleQuickSuccess(newId: string) {
        fetchMasterData().then(() => {
            if (quickDialog?.type === 'uoms') setFormData(prev => ({ ...prev, uom_id: newId }))
            if (quickDialog?.type === 'sizes') setFormData(prev => ({ ...prev, size_id: newId }))
            if (quickDialog?.type === 'colors') setFormData(prev => ({ ...prev, color_id: newId }))
            if (quickDialog?.type === 'product_parents') setFormData(prev => ({ ...prev, parent_id: newId }))
        })
    }

    // Helper for Select with Add Button
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SelectWithAdd = ({ label, value, onChange, options, onAdd }: any) => (
        <div className="flex flex-col mb-3">
            <div className="flex justify-between items-center mb-1.5">
                <label className="text-sm font-medium text-[var(--text-main)]">{label}</label>
                <button
                    type="button"
                    onClick={onAdd}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5"
                >
                    <Icons.Plus className="w-3 h-3" /> New
                </button>
            </div>
            <select
                className="flex h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                value={value || ''}
                onChange={onChange}
            >
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {options.map((opt: any) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    )

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}

                <div className="grid grid-cols-2 gap-2">
                    <Input label="SKU" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} required />
                    <Select
                        label="Type"
                        value={formData.type}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                        options={[
                            { label: 'Finished', value: 'FINISHED_GOOD' },
                            { label: 'Raw Material', value: 'RAW_MATERIAL' }
                        ]}
                    />
                </div>
                <Input label="Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />

                {/* Parent with Quick Add */}
                <SelectWithAdd
                    label="Parent Product (Optional)"
                    value={formData.parent_id}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onChange={(e: any) => setFormData({ ...formData, parent_id: e.target.value || undefined })}
                    options={[{ label: '-- No Parent --', value: '' }, ...parents.map(p => ({ label: p.name, value: p.id }))]}
                    onAdd={() => setQuickDialog({ type: 'product_parents', title: 'Product Parent' })}
                />

                <div className="grid grid-cols-3 gap-2">
                    <SelectWithAdd
                        label="UoM"
                        value={formData.uom_id}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onChange={(e: any) => setFormData({ ...formData, uom_id: e.target.value })}
                        options={uoms.map(u => ({ label: u.code || u.name, value: u.id }))}
                        onAdd={() => setQuickDialog({ type: 'uoms', title: 'UoM' })}
                    />
                    <SelectWithAdd
                        label="Size"
                        value={formData.size_id}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onChange={(e: any) => setFormData({ ...formData, size_id: e.target.value })}
                        options={sizes.map(s => ({ label: s.code || s.name, value: s.id }))}
                        onAdd={() => setQuickDialog({ type: 'sizes', title: 'Size' })}
                    />
                    <SelectWithAdd
                        label="Color"
                        value={formData.color_id}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onChange={(e: any) => setFormData({ ...formData, color_id: e.target.value })}
                        options={colors.map(c => ({ label: c.code || c.name, value: c.id }))}
                        onAdd={() => setQuickDialog({ type: 'colors', title: 'Color' })}
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
                    <Button type="submit" disabled={loading} className="w-full sm:w-auto min-h-[44px]">
                        {existingItem ? 'Update' : 'Add'} Item
                    </Button>
                    <Button type="button" variant="secondary" onClick={onCancel} className="w-full sm:w-auto">Cancel</Button>
                </div>
            </form>

            {quickDialog && (
                <QuickMasterDialog
                    isOpen={!!quickDialog}
                    table={quickDialog.type}
                    title={quickDialog.title}
                    onClose={() => setQuickDialog(null)}
                    onSuccess={handleQuickSuccess}
                    hasCode={quickDialog.type !== 'product_parents'}
                    hasSort={quickDialog.type !== 'product_parents'}
                />
            )}
        </>
    )
}
