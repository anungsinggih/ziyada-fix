import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Icons } from './ui/Icons'

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

    useEffect(() => {
        fetchItems()
    }, [table])

    async function fetchItems() {
        setLoading(true)
        let query = supabase.from(table).select('*')
        if (hasSort) query = query.order('sort_order', { ascending: true })
        else query = query.order('name', { ascending: true })

        const { data, error } = await query
        if (error) setError(error.message)
        else setItems(data || [])
        setLoading(false)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        try {
            const payload: any = { name: formData.name, is_active: formData.is_active }
            if (hasCode) payload.code = formData.code
            if (hasSort) payload.sort_order = formData.sort_order

            if (editingId) {
                const { error } = await supabase.from(table).update(payload).eq('id', editingId)
                if (error) throw error
            } else {
                const { error } = await supabase.from(table).insert([payload])
                if (error) throw error
            }
            resetForm()
            fetchItems()
        } catch (err: any) {
            setError(err.message)
        }
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

    function handleEdit(item: MasterItem) {
        setEditingId(item.id)
        setFormData(item)
    }

    return (
        <Card className="h-full">
            <CardHeader className="py-3">
                <CardTitle className="text-lg flex justify-between items-center">
                    {title}
                    {loading && <span className="text-xs font-normal text-gray-500 animate-pulse">Syncing...</span>}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {error && <div className="text-red-500 text-sm mb-2">{error}</div>}

                <form onSubmit={handleSubmit} className="flex gap-2 mb-4 items-end">
                    {hasCode && <div className="w-24"><Input label="Code" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} /></div>}
                    <div className="flex-1"><Input label="Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></div>
                    {hasSort && <div className="w-20"><Input label="Sort" type="number" value={formData.sort_order} onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })} /></div>}
                    <Button type="submit" size="sm" className="mb-[2px]">{editingId ? 'Upd' : 'Add'}</Button>
                    {editingId && <Button type="button" size="sm" variant="secondary" onClick={resetForm} className="mb-[2px]">X</Button>}
                </form>

                <div className="overflow-auto max-h-[300px]">
                    <Table>
                        <TableHead>
                            <TableRow>
                                {hasCode && <TableHeader className="whitespace-nowrap">Code</TableHeader>}
                                <TableHeader className="whitespace-nowrap">Name</TableHeader>
                                <TableHeader className="w-16 whitespace-nowrap">Act</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {items.map(item => (
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
            </CardContent>
        </Card>
    )
}
