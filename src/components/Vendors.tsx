import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Switch } from './ui/Switch'
import { Textarea } from './ui/Textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Badge } from './ui/Badge'
import { Icons } from './ui/Icons'

type Vendor = {
    id: string
    name: string
    phone: string
    address: string
    is_active: boolean
}

export default function Vendors() {
    const [vendors, setVendors] = useState<Vendor[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState<Partial<Vendor>>({
        name: '', phone: '', address: '', is_active: true
    })

    useEffect(() => {
        fetchVendors()
    }, [])

    async function fetchVendors() {
        setLoading(true)
        const { data, error } = await supabase
            .from('vendors')
            .select('*')
            .order('name', { ascending: true })

        if (error) setError(error.message)
        else setVendors(data || [])
        setLoading(false)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)

        try {
            if (editingId) {
                const { error } = await supabase
                    .from('vendors')
                    .update(formData)
                    .eq('id', editingId)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('vendors')
                    .insert([formData])
                if (error) throw error
            }

            resetForm()
            fetchVendors()
        } catch (err: any) {
            setError(err.message)
        }
    }

    function resetForm() {
        setEditingId(null)
        setFormData({
            name: '', phone: '', address: '', is_active: true
        })
    }

    function handleEdit(vendor: Vendor) {
        setEditingId(vendor.id)
        setFormData(vendor)
    }

    async function handleDelete(id: string) {
        if (!confirm("Delete vendor?")) return
        const { error } = await supabase.from('vendors').delete().eq('id', id)
        if (error) alert("Could not delete. Try deactivating.")
        else fetchVendors()
    }

    return (
        <div className="w-full space-y-8">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Vendors Management</h2>
            {error && <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center gap-2"><Icons.Warning className="w-5 h-5 flex-shrink-0" /> Error: {error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                <div className="md:col-span-1">
                    <Card className="shadow-md sticky top-6">
                        <CardHeader className="bg-gray-50 border-b border-gray-100">
                            <CardTitle>{editingId ? 'Edit Vendor' : 'New Vendor'}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <Input label="Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="Vendor Name" />
                                <Input label="Phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="Optional" />
                                <Textarea label="Address" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Full Address" />

                                <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                                    <span className="text-sm font-medium text-gray-700">Active Status</span>
                                    <Switch
                                        checked={formData.is_active}
                                        onCheckedChange={checked => setFormData({ ...formData, is_active: checked })}
                                    />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                                        {editingId ? 'Update Vendor' : 'Create Vendor'}
                                    </Button>
                                    {editingId && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                <div className="md:col-span-2">
                    <Card className="shadow-md">
                        <CardHeader className="bg-gray-50 border-b border-gray-100">
                            <CardTitle>Vendor Directory</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableHeader>Name</TableHeader>
                                            <TableHeader>Phone</TableHeader>
                                            <TableHeader>Address</TableHeader>
                                            <TableHeader>Status</TableHeader>
                                            <TableHeader>Actions</TableHeader>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {loading ? <TableRow><TableCell colSpan={5} className="text-center">Loading...</TableCell></TableRow> : vendors.map(v => (
                                            <TableRow key={v.id} className={!v.is_active ? 'bg-gray-100 opacity-60' : ''}>
                                                <TableCell className="font-medium">{v.name}</TableCell>
                                                <TableCell>{v.phone}</TableCell>
                                                <TableCell className="max-w-xs truncate">{v.address}</TableCell>
                                                <TableCell>
                                                    <Badge variant={v.is_active ? 'success' : 'secondary'}>
                                                        {v.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="space-x-2 flex">
                                                    <Button size="sm" variant="outline" onClick={() => handleEdit(v)} icon={<Icons.Edit className="w-4 h-4" />} />
                                                    <Button size="sm" variant="danger" onClick={() => handleDelete(v.id)} icon={<Icons.Trash className="w-4 h-4" />} />
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
        </div>
    )
}
