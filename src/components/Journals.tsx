import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Input } from './ui/Input'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Icons } from './ui/Icons'

type JournalEntry = {
    id: string
    journal_date: string
    ref_type: string
    ref_id: string
    memo: string
    created_at: string
    lines: JournalLine[]
}

type JournalLine = {
    id: string
    account_code: string
    account_name: string
    debit: number
    credit: number
}

export default function Journals() {
    const [journals, setJournals] = useState<JournalEntry[]>([])
    const [filteredJournals, setFilteredJournals] = useState<JournalEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    useEffect(() => {
        fetchJournals()
        // Set default date range to current month
        const now = new Date()
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        setStartDate(firstDay.toISOString().split('T')[0])
        setEndDate(now.toISOString().split('T')[0])
    }, [])

    useEffect(() => {
        filterJournals()
    }, [searchTerm, startDate, endDate, journals])

    async function fetchJournals() {
        setLoading(true)
        setError(null)

        try {
            // Fetch journals with their lines
            const { data: journalsData, error: journalsError } = await supabase
                .from('journals')
                .select('*')
                .order('journal_date', { ascending: false })
                .order('created_at', { ascending: false })

            if (journalsError) throw journalsError

            // Fetch all journal lines
            const { data: linesData, error: linesError } = await supabase
                .from('journal_lines')
                .select(`
                    id,
                    journal_id,
                    account_id,
                    debit,
                    credit,
                    accounts (
                        code,
                        name
                    )
                `)

            if (linesError) throw linesError

            // Group lines by journal_id
            const linesMap: { [key: string]: JournalLine[] } = {}
            linesData?.forEach((line: any) => {
                if (!linesMap[line.journal_id]) {
                    linesMap[line.journal_id] = []
                }
                linesMap[line.journal_id].push({
                    id: line.id,
                    account_code: line.accounts?.code || '',
                    account_name: line.accounts?.name || '',
                    debit: line.debit || 0,
                    credit: line.credit || 0
                })
            })

            // Combine journals with their lines
            const enrichedJournals = journalsData?.map(journal => ({
                ...journal,
                lines: linesMap[journal.id] || []
            })) || []

            setJournals(enrichedJournals)
            setFilteredJournals(enrichedJournals)
        } catch (err: any) {
            setError(err.message || 'Failed to fetch journals')
        } finally {
            setLoading(false)
        }
    }

    function filterJournals() {
        let filtered = [...journals]

        // Filter by search term (memo or ref_type)
        if (searchTerm) {
            filtered = filtered.filter(j =>
                j.memo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                j.ref_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                j.ref_id?.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        // Filter by date range
        if (startDate) {
            filtered = filtered.filter(j => j.journal_date >= startDate)
        }
        if (endDate) {
            filtered = filtered.filter(j => j.journal_date <= endDate)
        }

        setFilteredJournals(filtered)
    }

    function formatCurrency(amount: number) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount)
    }

    function getRefTypeBadge(refType: string) {
        const colors: { [key: string]: string } = {
            'SALES': 'bg-green-100 text-green-800',
            'PURCHASE': 'bg-blue-100 text-blue-800',
            'SALES_RETURN': 'bg-yellow-100 text-yellow-800',
            'RECEIPT': 'bg-purple-100 text-purple-800',
            'PAYMENT': 'bg-red-100 text-red-800',
            'ADJUSTMENT': 'bg-gray-100 text-gray-800'
        }
        return (
            <Badge className={colors[refType] || 'bg-gray-100 text-gray-800'}>
                {refType}
            </Badge>
        )
    }

    if (loading) {
        return (
            <div className="w-full p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <p className="mt-2 text-gray-600">Loading journals...</p>
            </div>
        )
    }

    return (
        <div className="w-full space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-3xl font-bold tracking-tight text-gray-900">Journal Entries</h2>
                <Button
                    onClick={fetchJournals}
                    variant="outline"
                    icon={<Icons.Refresh className="w-4 h-4" />}
                >
                    Refresh
                </Button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center gap-2">
                    <Icons.Warning className="w-5 h-5" /> {error}
                </div>
            )}

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                        <Input
                            label="Search (Type / Memo / ID)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search journals..."
                        />
                        <Input
                            label="Start Date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <Input
                            label="End Date"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Summary */}
            <div className="flex flex-col gap-1 text-sm text-gray-600 sm:flex-row sm:justify-between sm:items-center">
                <span>Showing <strong>{filteredJournals.length}</strong> of <strong>{journals.length}</strong> journal entries</span>
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    <span>Total: {formatCurrency(journals.reduce((sum, j) => sum + j.lines.reduce((s, l) => s + l.debit + l.credit, 0), 0))}</span>
                    <span className="hidden sm:inline-block">·</span>
                    <span>Balanced count: {filteredJournals.filter(j => j.lines.reduce((s,l)=>s+l.debit,0) === j.lines.reduce((s,l)=>s+l.credit,0)).length}</span>
                </div>
            </div>

            {/* Journal List */}
            <div className="space-y-4">
                {filteredJournals.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center text-gray-500">
                            <p className="text-lg flex items-center justify-center gap-2"><Icons.FileText className="w-5 h-5" /> No journal entries found</p>
                            <p className="text-sm mt-2">Journals are automatically created when transactions are posted</p>
                        </CardContent>
                    </Card>
                ) : (
                    filteredJournals.map((journal) => {
                        const totalDebit = journal.lines.reduce((sum, line) => sum + line.debit, 0)
                        const totalCredit = journal.lines.reduce((sum, line) => sum + line.credit, 0)
                        const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

                        return (
                            <Card key={journal.id} className="shadow-md">
                                <CardHeader className="bg-gray-50 border-b border-gray-200">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-lg font-semibold text-gray-900">
                                                    {journal.ref_type} - {journal.ref_id.substring(0, 8)}
                                                </h3>
                                                {getRefTypeBadge(journal.ref_type)}
                                                {isBalanced ? (
                                                    <Badge className="bg-green-100 text-green-800 flex items-center gap-1"><Icons.Check className="w-3 h-3" /> Balanced</Badge>
                                                ) : (
                                                    <Badge className="bg-red-100 text-red-800 flex items-center gap-1"><Icons.Warning className="w-3 h-3" /> Unbalanced</Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600">{journal.memo || 'No description'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-medium text-gray-900">
                                                {new Date(journal.journal_date).toLocaleDateString('id-ID')}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(journal.created_at).toLocaleString('id-ID')}
                                            </p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHead>
                                                <TableRow>
                                                    <TableHeader>Account Code</TableHeader>
                                                    <TableHeader>Account Name</TableHeader>
                                                    <TableHeader className="text-right">Debit</TableHeader>
                                                    <TableHeader className="text-right">Credit</TableHeader>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {journal.lines.map((line) => (
                                                    <TableRow key={line.id}>
                                                        <TableCell className="font-mono text-sm">{line.account_code}</TableCell>
                                                        <TableCell>{line.account_name}</TableCell>
                                                        <TableCell className="text-right font-medium">
                                                            {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-right font-medium">
                                                            {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {/* Totals Row */}
                                                <TableRow className="bg-gray-50 font-bold border-t-2 border-gray-300">
                                                    <TableCell colSpan={2} className="text-right">TOTAL:</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(totalDebit)}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(totalCredit)}</TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                )}
            </div>
        </div>
    )
}
