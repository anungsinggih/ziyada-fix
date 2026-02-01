import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Button } from './ui/Button'
import { Icons } from './ui/Icons'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog'
import CustomerForm, { type Customer } from './CustomerForm'
import CustomerList from './CustomerList'

export default function Customers() {
    const [customers, setCustomers] = useState<Customer[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    async function fetchCustomers() {
        setLoading(true)
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('name', { ascending: true })

        if (error) setError(error.message)
        else setCustomers(data as Customer[] || [])
        setLoading(false)
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchCustomers()
    }, [])

    function handleSuccess() {
        setEditingCustomer(null)
        setIsModalOpen(false)
        fetchCustomers()
    }

    function handleAddCustomer() {
        setEditingCustomer(null)
        setIsModalOpen(true)
    }

    function handleEdit(customer: Customer) {
        setEditingCustomer(customer)
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="hidden md:block text-2xl font-bold tracking-tight">Customers Management</h2>
                <Button onClick={handleAddCustomer} icon={<Icons.Plus className="w-4 h-4" />} className="w-full sm:w-auto">Add Customer</Button>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center gap-2"><Icons.Warning className="w-5 h-5 flex-shrink-0" /> Error: {error}</div>}

            <CustomerList
                customers={customers}
                loading={loading}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />

            <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <DialogHeader>
                    <DialogTitle>{editingCustomer ? 'Edit Customer' : 'New Customer'}</DialogTitle>
                </DialogHeader>
                <DialogContent>
                    <CustomerForm
                        initialData={editingCustomer}
                        onSuccess={handleSuccess}
                        onCancel={() => setIsModalOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}
