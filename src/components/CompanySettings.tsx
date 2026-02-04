import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Icons } from './ui/Icons'
import { Textarea } from './ui/Textarea'
import { Checkbox } from './ui/Checkbox'

type CompanyProfile = {
    id: string
    name: string
    address: string
    phone: string
    email: string
    bank_name: string
    bank_account: string
    bank_holder: string
    logo_url: string
}

type CompanyBank = {
    id?: string
    code: string
    bank_name: string
    account_number: string
    account_holder: string
    is_active: boolean
    is_default: boolean
}

export default function CompanySettings() {
    const [profile, setProfile] = useState<CompanyProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [banks, setBanks] = useState<CompanyBank[]>([])
    const [banksSaving, setBanksSaving] = useState(false)
    const [bankError, setBankError] = useState<string | null>(null)
    const [initialBankIds, setInitialBankIds] = useState<string[]>([])

    useEffect(() => {
        fetchProfile()
        fetchBanks()
    }, [])

    async function fetchProfile() {
        try {
            const { data } = await supabase
                .from('company_profile')
                .select('*')
                .single()

            if (data) {
                setProfile(data)
            } else {
                // Initialize empty profile if none exists
                setProfile({
                    id: '', // Will be ignored on insert if we handle it right, or we let DB gen it
                    name: '',
                    address: '',
                    phone: '',
                    email: '',
                    bank_name: '',
                    bank_account: '',
                    bank_holder: '',
                    logo_url: ''
                })
            }
        } catch (error: unknown) {
            // .single() returns error if no rows found, which is expected for fresh DB
            const pgError = error as { code?: string, message?: string }
            if (pgError?.code === 'PGRST116') {
                setProfile({
                    id: '',
                    name: '',
                    address: '',
                    phone: '',
                    email: '',
                    bank_name: '',
                    bank_account: '',
                    bank_holder: '',
                    logo_url: ''
                })
            } else {
                console.error('Error fetching profile:', error)
            }
        } finally {
            setLoading(false)
        }
    }

    async function fetchBanks() {
        const { data, error } = await supabase
            .from('company_banks')
            .select('*')
            .order('is_default', { ascending: false })
            .order('bank_name', { ascending: true })
        if (!error) {
            setBanks(data || [])
            setInitialBankIds((data || []).map((b) => b.id))
        }
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        if (!profile) return

        setSaving(true)
        setMessage(null)

        try {
            // Prepare payload
            const payload = {
                name: profile.name,
                address: profile.address,
                phone: profile.phone,
                email: profile.email,
                bank_name: profile.bank_name,
                bank_account: profile.bank_account,
                bank_holder: profile.bank_holder,
                // logo_url: profile.logo_url
            }

            let result;
            if (profile.id) {
                // Update existing
                result = await supabase
                    .from('company_profile')
                    .update(payload)
                    .eq('id', profile.id)
            } else {
                // Insert new (Singleton)
                result = await supabase
                    .from('company_profile')
                    .insert([payload])
                    .select()
                    .single()
            }

            if (result.error) throw result.error

            // If insert, update local state with new ID
            if (!profile.id && result.data) {
                setProfile(result.data)
            }

            setMessage({ type: 'success', text: 'Settings saved successfully' })
        } catch (error: unknown) {
            console.error('Error updating profile:', error)
            const msg = error instanceof Error ? error.message : 'Unknown error'
            setMessage({ type: 'error', text: 'Failed to save settings: ' + msg })
        } finally {
            setSaving(false)
        }
    }

    const setDefaultBank = (index: number) => {
        setBanks((prev) =>
            prev.map((b, i) => ({
                ...b,
                is_default: i === index
            }))
        )
    }

    const addBank = () => {
        setBanks((prev) => [
            ...prev,
            {
                code: '',
                bank_name: '',
                account_number: '',
                account_holder: '',
                is_active: true,
                is_default: prev.length === 0
            }
        ])
    }

    const removeBank = (index: number) => {
        setBanks((prev) => prev.filter((_, i) => i !== index))
    }

    async function handleSaveBanks() {
        setBanksSaving(true)
        setBankError(null)
        try {
            if (banks.length === 0) {
                setBankError('Tambahkan minimal 1 bank.')
                return
            }
            let normalizedBanks = banks
            if (!normalizedBanks.some((b) => b.is_default)) {
                normalizedBanks = normalizedBanks.map((b, i) => ({ ...b, is_default: i === 0 }))
                setBanks(normalizedBanks)
            }
            for (const bank of normalizedBanks) {
                if (!bank.code.trim() || !bank.bank_name.trim() || !bank.account_number.trim() || !bank.account_holder.trim()) {
                    throw new Error('Kode, Nama Bank, No Rekening, dan Nama Pemilik wajib diisi.')
                }
            }

            const currentIds = normalizedBanks.filter((b) => b.id).map((b) => b.id as string)
            const toDelete = initialBankIds.filter((id) => !currentIds.includes(id))
            if (toDelete.length) {
                const { error: delError } = await supabase.from('company_banks').delete().in('id', toDelete)
                if (delError) throw delError
            }

            for (const bank of normalizedBanks) {
                const payload = {
                    code: bank.code.trim().toUpperCase(),
                    bank_name: bank.bank_name.trim(),
                    account_number: bank.account_number.trim(),
                    account_holder: bank.account_holder.trim(),
                    is_active: bank.is_active,
                    is_default: bank.is_default
                }
                if (bank.id) {
                    const { error } = await supabase.from('company_banks').update(payload).eq('id', bank.id)
                    if (error) throw error
                } else {
                    const { data, error } = await supabase.from('company_banks').insert([payload]).select('id').single()
                    if (error) throw error
                    bank.id = data?.id
                }
            }
            setMessage({ type: 'success', text: 'Bank accounts saved successfully' })
            fetchBanks()
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error'
            setBankError(msg)
        } finally {
            setBanksSaving(false)
        }
    }

    if (loading) return <div className="p-8 text-center">Loading settings...</div>

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h2 className="hidden md:block text-3xl font-bold tracking-tight">Settings</h2>
                <p className="text-gray-500">Manage your company profile and invoice settings.</p>
            </div>

            {message && (
                <div className={`p-4 rounded-md flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.type === 'success' ? <Icons.Check className="w-5 h-5" /> : <Icons.Warning className="w-5 h-5" />}
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSave}>
                <Card>
                    <CardHeader>
                        <CardTitle>Company Profile</CardTitle>
                        <CardDescription>These details will appear on your printed invoices.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Company Name"
                                value={profile?.name || ''}
                                onChange={e => setProfile(prev => prev ? { ...prev, name: e.target.value } : null)}
                                required
                            />
                            <Input
                                label="Email"
                                type="email"
                                value={profile?.email || ''}
                                onChange={e => setProfile(prev => prev ? { ...prev, email: e.target.value } : null)}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Phone"
                                value={profile?.phone || ''}
                                onChange={e => setProfile(prev => prev ? { ...prev, phone: e.target.value } : null)}
                            />
                            <div className="col-span-1 md:col-span-2">
                                <Textarea
                                    label="Address"
                                    value={profile?.address || ''}
                                    onChange={e => setProfile(prev => prev ? { ...prev, address: e.target.value } : null)}
                                    rows={3}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>


                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>Bank Accounts</CardTitle>
                        <CardDescription>Used for invoice/print based on payment method (BCA/BRI).</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {bankError && (
                            <div className="bg-red-50 text-red-700 p-3 rounded text-sm border border-red-200">
                                <Icons.Warning className="w-4 h-4 inline mr-2" />
                                {bankError}
                            </div>
                        )}
                        <div className="space-y-3">
                            {banks.map((bank, idx) => (
                                <div key={bank.id || idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border rounded-md p-3">
                                    <div className="md:col-span-2">
                                        <Input
                                            label="Code"
                                            placeholder="BCA"
                                            value={bank.code}
                                            onChange={(e) => {
                                                const val = e.target.value
                                                setBanks((prev) => prev.map((b, i) => i === idx ? { ...b, code: val } : b))
                                            }}
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <Input
                                            label="Bank Name"
                                            placeholder="Bank BCA"
                                            value={bank.bank_name}
                                            onChange={(e) => {
                                                const val = e.target.value
                                                setBanks((prev) => prev.map((b, i) => i === idx ? { ...b, bank_name: val } : b))
                                            }}
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <Input
                                            label="Account Number"
                                            placeholder="123-456-7890"
                                            value={bank.account_number}
                                            onChange={(e) => {
                                                const val = e.target.value
                                                setBanks((prev) => prev.map((b, i) => i === idx ? { ...b, account_number: val } : b))
                                            }}
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <Input
                                            label="Account Holder"
                                            placeholder="PT Example"
                                            value={bank.account_holder}
                                            onChange={(e) => {
                                                const val = e.target.value
                                                setBanks((prev) => prev.map((b, i) => i === idx ? { ...b, account_holder: val } : b))
                                            }}
                                        />
                                    </div>
                                    <div className="md:col-span-1 flex flex-col gap-2">
                                        <Checkbox
                                            label="Active"
                                            checked={bank.is_active}
                                            onChange={(e) => {
                                                const checked = e.currentTarget.checked
                                                setBanks((prev) => prev.map((b, i) => i === idx ? { ...b, is_active: checked } : b))
                                            }}
                                        />
                                        <Checkbox
                                            label="Default"
                                            checked={bank.is_default}
                                            onChange={() => setDefaultBank(idx)}
                                        />
                                    </div>
                                    <div className="md:col-span-12 flex justify-end">
                                        <Button type="button" variant="danger" size="sm" onClick={() => removeBank(idx)} icon={<Icons.Trash className="w-4 h-4" />}>
                                            Remove
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between items-center">
                            <Button type="button" variant="outline" onClick={addBank} icon={<Icons.Plus className="w-4 h-4" />}>
                                Add Bank
                            </Button>
                            <Button type="button" onClick={handleSaveBanks} disabled={banksSaving}>
                                {banksSaving ? 'Saving...' : 'Save Banks'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <div className="mt-6 flex justify-end">
                    <Button type="submit" disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </div>
    )
}
