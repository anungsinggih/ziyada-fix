import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Button } from './ui/Button'
import { Icons } from './ui/Icons'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog'
import VendorList from './VendorList'
import VendorForm, { type Vendor } from './VendorForm'
import { getErrorMessage } from '../lib/errors'
import { formatCurrency } from '../lib/format'
import { useNavigate } from 'react-router-dom'

export default function Vendors() {
    const navigate = useNavigate()
    const [vendors, setVendors] = useState<Vendor[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [statsLoading, setStatsLoading] = useState(false)
    const [stats, setStats] = useState<{
        total: number;
        active: number;
        inactive: number;
        outstanding: number | null;
    }>({
        total: 0,
        active: 0,
        inactive: 0,
        outstanding: null
    })

    const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    async function fetchVendors() {
        setLoading(true)
        const { data, error } = await supabase
            .from('vendors')
            .select('*')
            .order('name', { ascending: true })

        if (error) {
            setError(getErrorMessage(error))
        } else {
            const list = (data as Vendor[]) || []
            setVendors(list)
            const active = list.filter(v => v.is_active).length
            setStats(prev => ({
                ...prev,
                total: list.length,
                active,
                inactive: list.length - active
            }))
        }
        setLoading(false)
    }

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

    function handleView(vendor: Vendor) {
        navigate(`/vendors/${vendor.id}`)
    }

    function handleCreatePurchase(vendor: Vendor) {
        navigate(`/purchases?vendor=${vendor.id}`)
    }

    async function handleDelete(id: string) {
        if (!confirm("Delete vendor?")) return
        const { error } = await supabase.from('vendors').delete().eq('id', id)
        if (error) alert("Could not delete. Try deactivating.")
        else fetchVendors()
    }

    async function fetchOutstanding() {
        setStatsLoading(true)
        const { data, error } = await supabase
            .from('ap_bills')
            .select('outstanding_amount,status')

        if (!error) {
            const sum = (data || [])
                .filter((row: { status: string }) => row.status !== 'PAID')
                .reduce((acc: number, row: { outstanding_amount: number | null }) => acc + (row.outstanding_amount || 0), 0)
            setStats(prev => ({ ...prev, outstanding: sum }))
        } else {
            setStats(prev => ({ ...prev, outstanding: null }))
        }
        setStatsLoading(false)
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchVendors()
            fetchOutstanding()
        }, 0)
        return () => clearTimeout(timer)
    }, [])

    return (
        <div className="w-full space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="hidden md:block text-2xl font-bold tracking-tight">Vendors Management</h2>
                <Button onClick={handleAddVendor} icon={<Icons.Plus className="w-4 h-4" />} className="w-full sm:w-auto">Add Vendor</Button>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center gap-2"><Icons.Warning className="w-5 h-5 flex-shrink-0" /> Error: {error}</div>}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider mb-1">Total Vendors</p>
                            <p className="text-3xl font-bold text-indigo-900">{stats.total}</p>
                        </div>
                        <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center shadow-sm">
                            <Icons.Users className="w-6 h-6 text-white" />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-1">Active / Inactive</p>
                            <p className="text-3xl font-bold text-emerald-900">{stats.active} <span className="text-lg text-slate-500">/</span> <span className="text-2xl text-slate-600">{stats.inactive}</span></p>
                        </div>
                        <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center shadow-sm">
                            <Icons.CheckCircle className="w-6 h-6 text-white" />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-rose-50 to-rose-100 border border-rose-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-rose-600 uppercase tracking-wider mb-1">Outstanding AP</p>
                            <p className="text-2xl font-bold text-rose-900">
                                {statsLoading ? '...' : stats.outstanding === null ? '-' : formatCurrency(stats.outstanding)}
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-rose-500 rounded-full flex items-center justify-center shadow-sm">
                            <Icons.DollarSign className="w-6 h-6 text-white" />
                        </div>
                    </div>
                </div>
            </div>

            <VendorList
                vendors={vendors}
                loading={loading}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onView={handleView}
                onCreatePurchase={handleCreatePurchase}
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
        </div >
    )
}
