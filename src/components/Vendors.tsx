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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog'

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
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formData, setFormData] = useState<Partial<Vendor>>({
        name: '', phone: '', address: '', is_active: true
    })
    const [searchTerm, setSearchTerm] = useState('')

    const filteredVendors = vendors.filter(v =>
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.phone && v.phone.includes(searchTerm)) ||
        (v.address && v.address.toLowerCase().includes(searchTerm.toLowerCase()))
    )

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
            handleSuccess()
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message)
            else setError('Unknown error')
        }
    }

    function handleSuccess() {
        resetForm()
        setIsModalOpen(false)
        fetchVendors()
    }

    function resetForm() {
        setEditingId(null)
        setFormData({
            name: '', phone: '', address: '', is_active: true
        })
    }

    function handleAddVendor() {
        resetForm()
        setIsModalOpen(true)
    }

    function handleEdit(vendor: Vendor) {
        setEditingId(vendor.id)
        setFormData(vendor)
        setIsModalOpen(true)
    }

    async function handleDelete(id: string) {
        if (!confirm("Delete vendor?")) return
        const { error } = await supabase.from('vendors').delete().eq('id', id)
        if (error) alert("Could not delete. Try deactivating.")
        else fetchVendors()
    }

    return (
        <div className="w-full space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Vendors Management</h2>
                <Button onClick={handleAddVendor} icon={<Icons.Plus className="w-4 h-4" />}>Add Vendor</Button>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center gap-2"><Icons.Warning className="w-5 h-5 flex-shrink-0" /> Error: {error}</div>}

            <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle>Vendor Directory</CardTitle>
                    <div className="w-1/3 min-w-[200px]">
                        <Input
                            placeholder="Search vendors..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="h-9 mb-0"
                            containerClassName="mb-0"
                        />
                    </div>
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
                                {loading ? <TableRow><TableCell colSpan={5} className="text-center">Loading...</TableCell></TableRow> : filteredVendors.map(v => (
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

            <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <DialogHeader>
                    <DialogTitle>{editingId ? 'Edit Vendor' : 'New Vendor'}</DialogTitle>
                </DialogHeader>
                <DialogContent>
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
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
