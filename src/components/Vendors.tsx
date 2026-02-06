import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Button } from './ui/Button'
import { Icons } from './ui/Icons'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog'
import VendorList from './VendorList'
import VendorForm, { type Vendor } from './VendorForm'
import { getErrorMessage } from '../lib/errors'

export default function Vendors() {
    const [vendors, setVendors] = useState<Vendor[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    async function fetchVendors() {
        setLoading(true)
        const { data, error } = await supabase
            .from('vendors')
            .select('*')
            .order('name', { ascending: true })

        if (error) setError(getErrorMessage(error))
        else setVendors(data as Vendor[] || [])
        setLoading(false)
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchVendors()
    }, [])

    function handleSuccess() {
        setEditingVendor(null)
        setIsModalOpen(false)
        fetchVendors()
    }

    function handleAddVendor() {
        setEditingVendor(null)
        setIsModalOpen(true)
    }

    function handleEdit(vendor: Vendor) {
        setEditingVendor(vendor)
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="hidden md:block text-2xl font-bold tracking-tight">Vendors Management</h2>
                <Button onClick={handleAddVendor} icon={<Icons.Plus className="w-4 h-4" />} className="w-full sm:w-auto">Add Vendor</Button>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center gap-2"><Icons.Warning className="w-5 h-5 flex-shrink-0" /> Error: {error}</div>}

            <VendorList
                vendors={vendors}
                loading={loading}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />

            <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <DialogHeader>
                    <DialogTitle>{editingVendor ? 'Edit Vendor' : 'New Vendor'}</DialogTitle>
                </DialogHeader>
                <DialogContent>
                    <VendorForm
                        initialData={editingVendor}
                        onSuccess={handleSuccess}
                        onCancel={() => setIsModalOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}
