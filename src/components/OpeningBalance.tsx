import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Badge } from './ui/Badge'
import { Icons } from './ui/Icons'

type Account = { id: string; code: string; name: string }

type Line = {
    account_id: string
    debit: number
    credit: number
}

type HistoryEntry = {
    date: string
    debit: number
    credit: number
    count: number
}

type HistoryDetail = {
    account_id: string
    code: string | null
    name: string | null
    debit: number
    credit: number
}

export default function OpeningBalance() {
    const [history, setHistory] = useState<HistoryEntry[]>([])
    const [historyDetails, setHistoryDetails] = useState<Record<string, HistoryDetail[]>>({})
    const [expandedDate, setExpandedDate] = useState<string | null>(null)
    const [accounts, setAccounts] = useState<Account[]>([])
    const [asOfDate, setAsOfDate] = useState('')
    const [lines, setLines] = useState<Line[]>([{ account_id: '', debit: 0, credit: 0 }])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    useEffect(() => {
        fetchAccounts()
        fetchHistory()
    }, [])

    async function fetchAccounts() {
        const { data, error } = await supabase.from('accounts').select('id, code, name').eq('is_active', true).order('code')
        if (error) setError(error.message)
        else setAccounts(data || [])
    }

    async function fetchHistory() {
        const { data, error } = await supabase
            .from('opening_balances')
            .select('as_of_date, debit, credit, account_id, accounts(code, name)')
        if (error) {
            console.error('Error fetching history:', error)
            return
        }

        // Aggregate by date
        const agg: Record<string, { date: string; debit: number; credit: number; count: number }> = {}
        const details: Record<string, HistoryDetail[]> = {}
        data?.forEach(row => {
            if (!agg[row.as_of_date]) {
                agg[row.as_of_date] = { date: row.as_of_date, debit: 0, credit: 0, count: 0 }
            }
            agg[row.as_of_date].debit += row.debit
            agg[row.as_of_date].credit += row.credit
            agg[row.as_of_date].count += 1
            if (!details[row.as_of_date]) details[row.as_of_date] = []
            const acct = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts
            details[row.as_of_date].push({
                account_id: row.account_id,
                code: acct?.code ?? null,
                name: acct?.name ?? null,
                debit: row.debit,
                credit: row.credit
            })
        })

        setHistory(Object.values(agg).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
        setHistoryDetails(details)
    }

    async function handleLoad(date: string) {
        setError(null)
        setSuccess(null)
        setLoading(true)
        setAsOfDate(date)
        try {
            const { data: lockedData, error: lockedError } = await supabase.rpc('is_date_in_closed_period', { d: date })
            if (lockedError) {
                throw lockedError
            }
            const locked = lockedData?.[0]?.is_date_in_closed_period
            if (locked) {
                setError(`Tanggal ${new Date(date).toLocaleDateString('id-ID')} sudah ditutup`)
                setLoading(false)
                return
            }
            const { data, error } = await supabase
                .from('opening_balances')
                .select('account_id, debit, credit')
                .eq('as_of_date', date)

            if (error) throw error

            if (data && data.length > 0) {
                setLines(data.map(d => ({
                    account_id: d.account_id,
                    debit: d.debit,
                    credit: d.credit
                })))
                setSuccess(`Loaded data for ${date}`)
            } else {
                setLines([{ account_id: '', debit: 0, credit: 0 }])
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    function addLine() {
        setLines([...lines, { account_id: '', debit: 0, credit: 0 }])
    }

    function removeLine(index: number) {
        setLines(lines.filter((_, i) => i !== index))
    }

    function updateLine(index: number, field: keyof Line, value: any) {
        const newLines = [...lines]
        newLines[index] = { ...newLines[index], [field]: value }
        setLines(newLines)
    }

    const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0)
    const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0)
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

    async function handleSave() {
        setError(null)
        setSuccess(null)

        if (!asOfDate) { setError("Date is required"); return }
        if (!isBalanced) { setError("Debits must equal Credits (T019)"); return }
        if (lines.some(l => !l.account_id)) { setError("All lines must have an account"); return }

        setLoading(true)

        try {
            const payload = lines.map(line => ({
                account_id: line.account_id,
                debit: Number(line.debit) || 0,
                credit: Number(line.credit) || 0
            }))

            const { error } = await supabase.rpc('rpc_set_opening_balance', {
                p_as_of_date: asOfDate,
                p_lines: payload
            })

            if (error) throw error
            setSuccess("Opening Balance saved successfully!")
            fetchHistory() // Refresh history
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // Format currency helper
    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val)

    return (
        <div className="w-full space-y-8 pb-10">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Opening Balance Setup</h2>
            {error && (
                <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center gap-2">
                    <Icons.Warning className="w-5 h-5 flex-shrink-0" /> {error}
                </div>
            )}
            {success && (
                <div className="p-4 bg-green-50 text-green-700 border border-green-200 rounded-md flex items-center gap-2">
                    <Icons.Check className="w-5 h-5 flex-shrink-0" /> {success}
                </div>
            )}

            <Card className="shadow-md">
                <CardHeader className="bg-gray-50 border-b border-gray-100 flex flex-row items-center justify-between">
                    <CardTitle>Journal Entry</CardTitle>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">As of Date:</span>
                        <Input type="date" value={asOfDate} onChange={e => {
                            setAsOfDate(e.target.value)
                            // Optional: auto-load if date matches history? May annoy if trying to create new.
                        }} className="w-40" />
                        <Button size="sm" variant="outline" onClick={() => handleLoad(asOfDate)} disabled={!asOfDate} icon={<Icons.Refresh className="w-4 h-4" />}>
                            Load
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeader className="w-[40%]">Account</TableHeader>
                                <TableHeader className="w-[20%]">Debit</TableHeader>
                                <TableHeader className="w-[20%]">Credit</TableHeader>
                                <TableHeader className="w-[10%]">Action</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {lines.map((line, i) => (
                                <TableRow key={i}>
                                    <TableCell>
                                        <Select
                                            value={line.account_id}
                                            onChange={e => updateLine(i, 'account_id', e.target.value)}
                                            options={[
                                                { label: "-- Select --", value: "" },
                                                ...accounts.map(a => ({ label: `${a.code} - ${a.name}`, value: a.id }))
                                            ]}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" step="0.01" value={line.debit} onChange={e => updateLine(i, 'debit', parseFloat(e.target.value))} />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" step="0.01" value={line.credit} onChange={e => updateLine(i, 'credit', parseFloat(e.target.value))} />
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="danger" size="sm" onClick={() => removeLine(i)} icon={<Icons.Trash className="w-4 h-4" />} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
                <CardFooter className="bg-gray-50 border-t border-gray-100 flex justify-between items-center py-4">
                    <Button variant="outline" onClick={addLine} icon={<Icons.Plus className="w-4 h-4" />}>Add Line</Button>

                    <div className="flex items-center gap-6">
                        <div className="flex gap-4 text-sm">
                            <div className="flex flex-col items-end">
                                <span className="text-gray-500">Total Debit</span>
                                <span className="font-mono font-bold">{formatCurrency(totalDebit)}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-gray-500">Total Credit</span>
                                <span className="font-mono font-bold">{formatCurrency(totalCredit)}</span>
                            </div>
                        </div>

                        <Badge variant={isBalanced ? 'success' : 'destructive'} className="text-sm px-3 py-1">
                            {isBalanced ? 'Balanced' : 'Unbalanced'}
                        </Badge>

                        <Button
                            className="bg-blue-600 hover:bg-blue-700 min-w-[150px]"
                            onClick={handleSave}
                            disabled={loading || !isBalanced}
                            icon={loading ? <Icons.Refresh className="w-4 h-4 animate-spin" /> : <Icons.Save className="w-4 h-4" />}
                        >
                            {loading ? 'Saving...' : 'Save Balance'}
                        </Button>
                    </div>
                </CardFooter>
            </Card>

            <div className="space-y-4">
                <h3 className="text-xl font-bold tracking-tight text-gray-900">History</h3>
                <Card className="shadow-sm">
                    <CardContent className="p-0">
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeader>As of Date</TableHeader>
                                    <TableHeader>Total Debit</TableHeader>
                                    <TableHeader>Total Credit</TableHeader>
                                    <TableHeader>Entries</TableHeader>
                                    <TableHeader className="text-right">Action</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {history.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                            No opening balance entries found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    history.map(h => (
                                        <Fragment key={h.date}>
                                            <TableRow>
                                                <TableCell className="font-medium">{new Date(h.date).toLocaleDateString('id-ID', { dateStyle: 'long' })}</TableCell>
                                                <TableCell>{formatCurrency(h.debit)}</TableCell>
                                                <TableCell>{formatCurrency(h.credit)}</TableCell>
                                                <TableCell>{h.count} Lines</TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    <Button size="sm" variant="outline" onClick={() => handleLoad(h.date)} icon={<Icons.Edit className="w-4 h-4" />}>
                                                        Load / Edit
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setExpandedDate(expandedDate === h.date ? null : h.date)}
                                                    >
                                                        {expandedDate === h.date ? 'Hide Detail' : 'Detail'}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                            {expandedDate === h.date && historyDetails[h.date] && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="bg-gray-50 p-4">
                                                        <div className="text-sm font-semibold mb-2">Detail per Akun</div>
                                                        <Table className="bg-white border">
                                                            <TableHead>
                                                                <TableRow>
                                                                    <TableHeader>Akun</TableHeader>
                                                                    <TableHeader>Debit</TableHeader>
                                                                    <TableHeader>Credit</TableHeader>
                                                                </TableRow>
                                                            </TableHead>
                                                            <TableBody>
                                                                {historyDetails[h.date].map(detail => (
                                                                    <TableRow key={`${detail.account_id}-${detail.debit}-${detail.credit}`}>
                                                                        <TableCell>
                                                                            {detail.code ? `${detail.code} - ${detail.name}` : detail.account_id}
                                                                        </TableCell>
                                                                        <TableCell>{formatCurrency(detail.debit)}</TableCell>
                                                                        <TableCell>{formatCurrency(detail.credit)}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </Fragment>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
