import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Icons } from './ui/Icons'
import { Textarea } from './ui/Textarea'

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

export default function CompanySettings() {
    const [profile, setProfile] = useState<CompanyProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useEffect(() => {
        fetchProfile()
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

    if (loading) return <div className="p-8 text-center">Loading settings...</div>

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
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
                        <CardTitle>Bank Information</CardTitle>
                        <CardDescription>Displayed in the payment instructions section of invoices.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                                label="Bank Name"
                                placeholder="e.g. BCA"
                                value={profile?.bank_name || ''}
                                onChange={e => setProfile(prev => prev ? { ...prev, bank_name: e.target.value } : null)}
                            />
                            <Input
                                label="Account Number"
                                placeholder="e.g. 123-456-7890"
                                value={profile?.bank_account || ''}
                                onChange={e => setProfile(prev => prev ? { ...prev, bank_account: e.target.value } : null)}
                            />
                            <Input
                                label="Account Holder"
                                placeholder="e.g. PT Example"
                                value={profile?.bank_holder || ''}
                                onChange={e => setProfile(prev => prev ? { ...prev, bank_holder: e.target.value } : null)}
                            />
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
