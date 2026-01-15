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

type MasterItem = {
    id: string
    name: string
    code?: string
    sort_order?: number
    is_active: boolean
}

export default function ProductParents() {
    const [parents, setParents] = useState<any[]>([])
    const [brands, setBrands] = useState<MasterItem[]>([])
    const [categories, setCategories] = useState<MasterItem[]>([])
    const [loading, setLoading] = useState(false)
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
        } catch (err: any) {
            alert(err.message)
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

    function handleEdit(p: any) {
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
    }

    return (
        <div className="w-full space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Product Parents</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 h-fit">
                    <CardHeader><CardTitle>Manage Parent Product</CardTitle></CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-1">
                                    <Input label="Code" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Ex: P-001" />
                                </div>
                                <div className="col-span-2">
                                    <Input label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                                </div>
                            </div>

                            <Select
                                label="Brand"
                                value={form.brand_id}
                                onChange={e => setForm({ ...form, brand_id: e.target.value })}
                                options={[{ label: '-- None --', value: '' }, ...brands.map(b => ({ label: b.name, value: b.id }))]}
                            />

                            <Select
                                label="Category"
                                value={form.category_id}
                                onChange={e => setForm({ ...form, category_id: e.target.value })}
                                options={[{ label: '-- None --', value: '' }, ...categories.map(c => ({ label: c.name, value: c.id }))]}
                            />

                            <ImageUpload
                                value={form.image_url}
                                onChange={(url) => setForm({ ...form, image_url: url })}
                                folder="product-parents"
                            />

                            <Textarea label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

                            <Checkbox label="Active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />

                            <div className="flex gap-2">
                                <Button type="submit" className="w-full">{form.id ? 'Update' : 'Add'}</Button>
                                {form.id && <Button type="button" variant="secondary" onClick={resetForm}>Cancel</Button>}
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader className="flex flex-row justify-between items-center">
                        <CardTitle>Product Parents List</CardTitle>
                        {loading && <span className="text-xs font-normal text-gray-500 animate-pulse">Syncing...</span>}
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-auto max-h-[600px]">
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableHeader className="whitespace-nowrap">Code</TableHeader>
                                        <TableHeader className="whitespace-nowrap">Name</TableHeader>
                                        <TableHeader className="whitespace-nowrap">Brand</TableHeader>
                                        <TableHeader className="whitespace-nowrap">Category</TableHeader>
                                        <TableHeader className="whitespace-nowrap">Active</TableHeader>
                                        <TableHeader className="whitespace-nowrap">Actions</TableHeader>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {parents.map(p => (
                                        <TableRow key={p.id}>
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
                                            <TableCell>{p.brand?.name || '-'}</TableCell>
                                            <TableCell>{p.category?.name || '-'}</TableCell>
                                            <TableCell>
                                                {p.is_active ? <span className="text-green-600 font-bold text-xs">Yes</span> : <span className="text-gray-400 text-xs">No</span>}
                                            </TableCell>
                                            <TableCell className="flex gap-2">
                                                <button onClick={() => handleEdit(p)} className="text-blue-600"><Icons.Edit className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(p.id)} className="text-red-600"><Icons.Trash className="w-4 h-4" /></button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
