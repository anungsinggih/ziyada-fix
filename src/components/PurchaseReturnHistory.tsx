import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import { Icons } from './ui/Icons'

type PurchaseReturnRecord = {
    id: string
    return_date: string
    purchase_id: string
    purchase_no: string | null
    vendor_name: string
    total_amount: number
    status: 'DRAFT' | 'POSTED' | 'VOID'
    created_at: string
    return_no: string
}

export default function PurchaseReturnHistory() {
    const [returns, setReturns] = useState<PurchaseReturnRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()

    useEffect(() => {
        fetchReturns()
    }, [])

    async function fetchReturns() {
        setLoading(true)
        setError(null)

        try {
            const { data, error: fetchError } = await supabase
                .from('purchase_returns')
                .select(`
                    id,
                    return_date,
                    purchase_id,
                    total_amount,
                    status,
                    created_at,
                    purchases!purchase_id (
                        purchase_no,
                        vendors (
                            name
                        )
                    )
                    , return_no
                `)
                .order('return_date', { ascending: false })
                .order('created_at', { ascending: false })

            if (fetchError) throw fetchError

            const enriched = data?.map(ret => ({
                ...ret,
                purchase_no: (ret.purchases as unknown as { purchase_no: string })?.purchase_no || 'N/A',
                vendor_name: (ret.purchases as unknown as { vendors: { name: string } })?.vendors?.name || 'Unknown',
                return_no: ret.return_no || ret.id.substring(0, 8)
            })) || []

            setReturns(enriched)
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message || 'Failed to fetch purchase returns')
        } finally {
            setLoading(false)
        }
    }

    function getStatusBadge(status: string) {
        const colors = {
            'DRAFT': 'bg-gray-100 text-gray-800',
            'POSTED': 'bg-green-100 text-green-800',
            'VOID': 'bg-red-100 text-red-800'
        }
        return (
            <Badge className={colors[status as keyof typeof colors] || 'bg-gray-100'}>
                {status}
            </Badge>
        )
    }

    function formatCurrency(amount: number) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount)
    }

    if (loading) {
        return (
            <div className="w-full p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <p className="mt-2 text-gray-600">Loading purchase returns...</p>
            </div>
        )
    }

    return (
        <div className="w-full space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight text-gray-900">Purchase Return History</h2>
                <div className="flex gap-2">
                    <Button onClick={fetchReturns} variant="outline" icon={<Icons.Refresh className="w-4 h-4" />}>
                        Refresh
                    </Button>
                    <Button onClick={() => navigate('/purchase-return')} icon={<Icons.Plus className="w-4 h-4" />}>
                        New Return
                    </Button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center gap-2">
                    <Icons.Warning className="w-5 h-5" /> {error}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>All Purchase Return Documents</CardTitle>
                </CardHeader>
                <CardContent>
                    {returns.length === 0 ? (
                        <div className="py-12 text-center text-gray-500">
                            <p className="text-lg flex items-center justify-center gap-2"><Icons.FileText className="w-5 h-5" /> No purchase return documents found</p>
                            <p className="text-sm mt-2">Create your first return to get started</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableHeader>Return Date</TableHeader>
                                        <TableHeader>Return No</TableHeader>
                                        <TableHeader>Original Purchase</TableHeader>
                                        <TableHeader>Vendor</TableHeader>
                                        <TableHeader className="text-right">Total</TableHeader>
                                        <TableHeader>Status</TableHeader>
                                        <TableHeader>Actions</TableHeader>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {returns.map((ret) => (
                                        <TableRow key={ret.id}>
                                            <TableCell>
                                                {new Date(ret.return_date).toLocaleDateString('id-ID')}
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">
                                                {ret.return_no}
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">
                                                {ret.purchase_no}
                                            </TableCell>
                                            <TableCell>{ret.vendor_name}</TableCell>
                                            <TableCell className="text-right font-medium">
                                                {formatCurrency(ret.total_amount)}
                                            </TableCell>
                                            <TableCell>{getStatusBadge(ret.status)}</TableCell>
                                            <TableCell>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => navigate(`/purchase-returns/${ret.id}`)}
                                                    icon={<Icons.Eye className="w-4 h-4" />}
                                                >
                                                    View
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
