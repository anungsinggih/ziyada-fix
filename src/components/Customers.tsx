import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Switch } from './ui/Switch'
import { Textarea } from './ui/Textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Badge } from './ui/Badge'
import { Icons } from './ui/Icons'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog'

type Customer = {
    id: string
    name: string
    phone: string
    address: string
    price_tier: 'UMUM' | 'KHUSUS'
    is_active: boolean
}

export default function Customers() {
    const [customers, setCustomers] = useState<Customer[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [editingId, setEditingId] = useState<string | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formData, setFormData] = useState<Partial<Customer>>({
        name: '', phone: '', address: '', price_tier: 'UMUM', is_active: true
    })
    const [searchTerm, setSearchTerm] = useState('')

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone && c.phone.includes(searchTerm)) ||
        (c.address && c.address.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    useEffect(() => {
        fetchCustomers()
    }, [])

    async function fetchCustomers() {
        setLoading(true)
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('name', { ascending: true })

        if (error) setError(error.message)
        else setCustomers(data || [])
        setLoading(false)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)

        try {
            if (editingId) {
                const { error } = await supabase
                    .from('customers')
                    .update(formData)
                    .eq('id', editingId)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('customers')
                    .insert([formData])
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
        fetchCustomers()
    }

    function resetForm() {
        setEditingId(null)
        setFormData({
            name: '', phone: '', address: '', price_tier: 'UMUM', is_active: true
        })
    }

    function handleAddCustomer() {
        resetForm()
        setIsModalOpen(true)
    }

    function handleEdit(customer: Customer) {
        setEditingId(customer.id)
        setFormData(customer)
        setIsModalOpen(true)
    }

    async function handleDelete(id: string) {
        if (!confirm("Delete customer?")) return
        const { error } = await supabase.from('customers').delete().eq('id', id)
        if (error) alert("Could not delete. Try deactivating.")
        else fetchCustomers()
    }

    return (
        <div className="w-full space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Customers Management</h2>
                <Button onClick={handleAddCustomer} icon={<Icons.Plus className="w-4 h-4" />}>Add Customer</Button>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center gap-2"><Icons.Warning className="w-5 h-5 flex-shrink-0" /> Error: {error}</div>}

            <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle>Customer Directory</CardTitle>
                    <div className="w-1/3 min-w-[200px]">
                        <Input
                            placeholder="Search customers..."
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
                                    <TableHeader>Tier</TableHeader>
                                    <TableHeader>Status</TableHeader>
                                    <TableHeader>Actions</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loading ? <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow> : filteredCustomers.map(c => (
                                    <TableRow key={c.id} className={!c.is_active ? 'bg-gray-100 opacity-60' : ''}>
                                        <TableCell className="font-medium">{c.name}</TableCell>
                                        <TableCell>{c.phone}</TableCell>
                                        <TableCell className="max-w-xs truncate">{c.address}</TableCell>
                                        <TableCell>
                                            <Badge variant={c.price_tier === 'KHUSUS' ? 'warning' : 'outline'}>{c.price_tier}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={c.is_active ? 'success' : 'secondary'}>
                                                {c.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="space-x-2 flex">
                                            <Button size="sm" variant="outline" onClick={() => handleEdit(c)} icon={<Icons.Edit className="w-4 h-4" />} />
                                            <Button size="sm" variant="danger" onClick={() => handleDelete(c.id)} icon={<Icons.Trash className="w-4 h-4" />} />
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
                    <DialogTitle>{editingId ? 'Edit Customer' : 'New Customer'}</DialogTitle>
                </DialogHeader>
                <DialogContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input label="Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="Company or Person Name" />
                        <Input label="Phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="Optional" />
                        <Textarea label="Address" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Full Address" />
                        <Select
                            label="Price Tier (T013)"
                            value={formData.price_tier}
                            onChange={e => setFormData({ ...formData, price_tier: e.target.value as 'UMUM' | 'KHUSUS' })}
                            options={[
                                { label: 'Umum (General)', value: 'UMUM' },
                                { label: 'Khusus (VIP/Special)', value: 'KHUSUS' }
                            ]}
                        />

                        <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                            <span className="text-sm font-medium text-gray-700">Active Status &nbsp;</span>
                            <Switch
                                checked={formData.is_active}
                                onCheckedChange={checked => setFormData({ ...formData, is_active: checked })}
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                                {editingId ? 'Update Customer' : 'Create Customer'}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
