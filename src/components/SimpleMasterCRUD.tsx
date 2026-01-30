import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Icons } from './ui/Icons'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog'
import { Checkbox } from './ui/Checkbox'

type MasterItem = {
    id: string
    name: string
    code?: string
    sort_order?: number
    is_active: boolean
}

type SimpleCRUDProps = {
    table: string
    title: string
    hasCode?: boolean
    hasSort?: boolean
}

export function SimpleMasterCRUD({ table, title, hasCode, hasSort }: SimpleCRUDProps) {
    const [items, setItems] = useState<MasterItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState<Partial<MasterItem>>({ name: '', code: '', sort_order: 0, is_active: true })
    const [searchTerm, setSearchTerm] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.code && item.code.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const fetchItems = useCallback(async () => {
        setLoading(true)
        let query = supabase.from(table).select('*')
        if (hasSort) query = query.order('sort_order', { ascending: true })
        else query = query.order('name', { ascending: true })

        const { data, error } = await query
        if (error) setError(error.message)
        else setItems(data || [])
        setLoading(false)
    }, [table, hasSort])

    useEffect(() => {
        fetchItems()
    }, [fetchItems])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const payload: Record<string, any> = { name: formData.name, is_active: formData.is_active }
            if (hasCode) payload.code = formData.code
            if (hasSort) payload.sort_order = formData.sort_order

            if (editingId) {
                const { error } = await supabase.from(table).update(payload).eq('id', editingId)
                if (error) throw error
            } else {
                const { error } = await supabase.from(table).insert([payload])
                if (error) throw error
            }
            handleSuccess()
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message)
            else setError('An unknown error occurred')
        }
    }

    function handleSuccess() {
        resetForm()
        setIsModalOpen(false)
        fetchItems()
    }

    async function handleDelete(id: string) {
        if (!confirm("Delete this item?")) return
        const { error } = await supabase.from(table).delete().eq('id', id)
        if (error) alert("Could not delete (likely referenced). Try deactivating.")
        else fetchItems()
    }

    function resetForm() {
        setEditingId(null)
        setFormData({ name: '', code: '', sort_order: 0, is_active: true })
    }

    function handleAdd() {
        resetForm()
        setIsModalOpen(true)
    }

    function handleEdit(item: MasterItem) {
        setEditingId(item.id)
        setFormData(item)
        setIsModalOpen(true)
    }

    return (
        <Card className="h-full">
            <CardHeader className="py-3">
                <CardTitle className="text-lg flex justify-between items-center gap-4">
                    <span>{title}</span>
                    <div className="flex items-center gap-2">
                        {loading && <span className="text-xs font-normal text-gray-500 animate-pulse">Syncing...</span>}
                        <Button size="sm" onClick={handleAdd} icon={<Icons.Plus className="w-3 h-3" />}>Add</Button>
                    </div>
                </CardTitle>
                <div className="pt-2">
                    <Input
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="h-8 text-xs mb-0"
                        containerClassName="mb-0"
                    />
                </div>
            </CardHeader>
            <CardContent>
                {error && <div className="text-red-500 text-sm mb-2">{error}</div>}

                <div className="overflow-auto max-h-[400px]">
                    <Table>
                        <TableHead>
                            <TableRow>
                                {hasCode && <TableHeader className="whitespace-nowrap">Code</TableHeader>}
                                <TableHeader className="whitespace-nowrap">Name</TableHeader>
                                <TableHeader className="w-16 whitespace-nowrap">Act</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredItems.map(item => (
                                <TableRow key={item.id}>
                                    {hasCode && <TableCell className="py-1">{item.code}</TableCell>}
                                    <TableCell className="py-1">{item.name}</TableCell>
                                    <TableCell className="py-1 flex gap-1">
                                        <button onClick={() => handleEdit(item)} className="text-blue-500 hover:text-blue-700"><Icons.Edit className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700"><Icons.Trash className="w-4 h-4" /></button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                    <DialogHeader>
                        <DialogTitle>{editingId ? `Edit ${title}` : `New ${title}`}</DialogTitle>
                    </DialogHeader>
                    <DialogContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {hasCode && <Input label="Code" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} />}
                            <Input label="Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                            {hasSort && <Input label="Sort Order" type="number" value={formData.sort_order} onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })} />}

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    label="Active"
                                    checked={formData.is_active}
                                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button type="submit" size="sm" className="w-full">{editingId ? 'Update' : 'Create'}</Button>
                                <Button type="button" size="sm" variant="secondary" onClick={() => setIsModalOpen(false)} className="w-full">Cancel</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    )
}
