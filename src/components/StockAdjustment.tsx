import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Textarea } from './ui/Textarea'
import { Icons } from './ui/Icons'

type Item = { id: string; name: string; sku: string }

export default function StockAdjustment() {
    const [items, setItems] = useState<Item[]>([])
    const [itemId, setItemId] = useState('')
    const [delta, setDelta] = useState(0)
    const [reason, setReason] = useState('')

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    useEffect(() => {
        fetchItems()
    }, [])

    async function fetchItems() {
        const { data } = await supabase.from('items').select('id, name, sku').order('name')
        setItems(data || [])
    }

    async function handleSubmit() {
        if (!itemId) { setError("Select Item"); return }
        if (delta === 0) { setError("Delta cannot be 0"); return }
        if (!reason) { setError("Reason required"); return }

        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const { error } = await supabase.rpc('rpc_adjust_stock', {
                p_item_id: itemId,
                p_qty_delta: delta,
                p_reason: reason
            })

            if (error) throw error
            setSuccess("Adjustment Saved!")
            setDelta(0)
            setReason('')
            setItemId('')
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message)
            else setError('Unknown error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full">
            <Card className="shadow-lg border-gray-200">
                <CardHeader className="bg-orange-50 border-b border-orange-100 pb-4">
                    <CardTitle className="text-xl text-orange-800">Stock Adjustment (Owner Only)</CardTitle>
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
                                { label: "-- Select Item --", value: "" },
                                ...items.map(i => ({ label: `${i.sku} - ${i.name}`, value: i.id }))
                            ]}
                        />

                        <div>
                            <Input
                                label="Qty Change (+/-)"
                                type="number"
                                value={delta}
                                onChange={e => setDelta(parseFloat(e.target.value))}
                                placeholder="e.g. 5 or -2"
                            />
                            <p className="text-xs text-gray-500 mt-1">Positive = Gain (Found), Negative = Loss (Damaged/Lost)</p>
                        </div>

                        <Textarea
                            label="Reason"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="Explain the adjustment..."
                            rows={3}
                        />
                    </div>
                </CardContent>
                <CardFooter className="bg-gray-50 border-t border-gray-100 p-6">
                    <Button onClick={handleSubmit} disabled={loading} className="w-full h-12 text-lg bg-orange-600 hover:bg-orange-700 text-white shadow-sm" icon={loading ? <Icons.Refresh className="animate-spin w-5 h-5" /> : <Icons.Save className="w-5 h-5" />}>
                        {loading ? 'Processing...' : 'Submit Adjustment'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}

