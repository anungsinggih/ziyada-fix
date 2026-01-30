import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Textarea } from './ui/Textarea'

type Item = { id: string; name: string; sku: string }

export default function OpeningStock() {
    const [items, setItems] = useState<Item[]>([])
    const [itemId, setItemId] = useState('')
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])
    const [qty, setQty] = useState(0)
    const [reason, setReason] = useState('Opening stock entry')

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    useEffect(() => {
        fetchItems()
    }, [])

    async function fetchItems() {
        const { data, error } = await supabase.from('items').select('id, name, sku').order('name')
        if (error) {
            setError(error.message)
        } else {
            setItems(data || [])
        }
    }

    async function handleSubmit() {
        setError(null)
        setSuccess(null)

        if (!itemId) { setError("Pilih item dulu"); return }
        if (qty < 0) { setError("Jumlah tidak boleh negatif"); return }
        if (!asOfDate) { setError("Tanggal pembukaan harus diisi"); return }

        setLoading(true)

        try {
            const { error } = await supabase.rpc('rpc_set_opening_stock', {
                p_item_id: itemId,
                p_qty: qty,
                p_as_of_date: asOfDate,
                p_reason: reason
            })
            if (error) throw error
            setSuccess('Opening stock tersimpan')
            setQty(0)
            setReason('Opening stock entry')
            setItemId('')
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message)
            else setError('An unknown error occurred')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full">
            <Card className="shadow-lg border-gray-200">
                <CardHeader className="bg-blue-50 border-b border-blue-100 pb-4">
                    <CardTitle className="text-xl text-blue-800">Opening Stock (Owner Only)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm font-medium">{error}</div>}
                    {success && <div className="p-3 bg-green-100 text-green-700 rounded-md text-sm font-medium">{success}</div>}

                    <div className="space-y-4">
                        <Select
                            label="Item"
                            value={itemId}
                            onChange={e => setItemId(e.target.value)}
                            options={[
                                { label: "-- Pilih Item --", value: "" },
                                ...items.map(i => ({ label: `${i.sku} - ${i.name}`, value: i.id }))
                            ]}
                        />

                        <Input label="As of Date" type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} />

                        <Input
                            label="Qty Target"
                            type="number"
                            step="0.001"
                            value={qty}
                            onChange={e => {
                                const parsed = parseFloat(e.target.value)
                                setQty(Number.isNaN(parsed) ? 0 : parsed)
                            }}
                        />

                        <Textarea
                            label="Catatan (opsional)"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            rows={3}
                        />
                    </div>
                    <p className="text-xs text-gray-500">
                        Opening stock akan membuat adjustment tertanggal pilihan tadi dan menyesuaikan stok aktual agar sesuai nilai target.
                    </p>
                </CardContent>
                <CardFooter className="bg-gray-50 border-t border-gray-100 p-6">
                    <Button onClick={handleSubmit} disabled={loading} className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700 text-white">
                        {loading ? 'Memproses...' : 'Simpan Opening Stock'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
