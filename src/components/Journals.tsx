import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Input } from './ui/Input'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Icons } from './ui/Icons'
import { useLocation } from 'react-router-dom'
import { formatCurrency, formatDate } from '../lib/format'

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

// --- SUB-COMPONENT: JOURNAL ITEM WITH ACCORDION ---
function JournalEntryItem({ journal, formatCurrency, getRefTypeBadge }: {
    journal: JournalEntry,
    formatCurrency: (n: number) => string,
    getRefTypeBadge: (t: string) => React.ReactNode
}) {
    const [isExpanded, setIsExpanded] = useState(false)
    const totalDebit = journal.lines.reduce((sum, line) => sum + line.debit, 0)
    const totalCredit = journal.lines.reduce((sum, line) => sum + line.credit, 0)
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01
    const docNoMatch = journal.memo?.match(/[A-Z]{3}-\d{6,}/)
    const docNo = docNoMatch?.[0]
    const cleanedMemo = journal.memo
        ? journal.memo.replace(/^POST\\s+/i, '').replace(docNo || '', '').trim()
        : ''

    return (
        <Card className="shadow-md transition-all hover:shadow-lg">
            <CardHeader
                className="bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors py-4"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-4">
                    {/* Icon Column */}
                    <div className="flex-shrink-0">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`
                                p-0 h-10 w-10 rounded-xl transition-all duration-200 border shadow-sm
                                ${isExpanded
                                    ? 'bg-blue-50 text-blue-700 border-blue-200 rotate-0'
                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300'
                                }
                            `}
                        >
                            {isExpanded ? <Icons.ChevronDown className="w-6 h-6" /> : <Icons.ChevronRight className="w-6 h-6" />}
                        </Button>
                    </div>

                    {/* Content Column */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <h3 className="text-lg font-semibold text-gray-900">
                                {docNo || cleanedMemo || `Journal ${journal.id.substring(0, 8)}`}
                            </h3>
                            {getRefTypeBadge(journal.ref_type)}
                            {isBalanced ? (
                                <Badge className="bg-green-100 text-green-800 flex items-center gap-1"><Icons.Check className="w-3 h-3" /> Balanced</Badge>
                            ) : (
                                <Badge className="bg-red-100 text-red-800 flex items-center gap-1"><Icons.Warning className="w-3 h-3" /> Unbalanced</Badge>
                            )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">
                            {cleanedMemo || `Ref: ${journal.ref_id.substring(0, 8)}`}
                        </p>
                    </div>

                    {/* Right Info Column */}
                    <div className="text-right flex-shrink-0 pl-2">
                        <p className="text-sm font-medium text-gray-900">
                            {formatDate(journal.journal_date)}
                        </p>
                        <p className="text-xs text-gray-500 mb-1">
                            {new Date(journal.created_at).toLocaleString('id-ID')}
                        </p>
                        <p className="font-bold text-gray-700">
                            {formatCurrency(totalDebit)}
                        </p>
                    </div>
                </div>
            </CardHeader>

            {isExpanded && (
                <CardContent className="pt-0 animate-in slide-in-from-top-2 duration-200">
                    <div className="overflow-x-auto border-t border-gray-200">
                        <Table>
                            <TableHeader className="bg-gray-50/50">
                                <TableRow>
                                    <TableHead className="pl-6">Account Code</TableHead>
                                    <TableHead>Account Name</TableHead>
                                    <TableHead className="text-right">Debit</TableHead>
                                    <TableHead className="text-right pr-6">Credit</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {journal.lines.map((line) => (
                                    <TableRow key={line.id}>
                                        <TableCell className="font-mono text-sm pl-6">{line.account_code}</TableCell>
                                        <TableCell>{line.account_name}</TableCell>
                                        <TableCell className="text-right font-medium">
                                            {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-medium pr-6">
                                            {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {/* Totals Row */}
                                <TableRow className="bg-gray-50 font-bold border-t-2 border-gray-300">
                                    <TableCell colSpan={2} className="text-right">TOTAL:</TableCell>
                                    <TableCell className="text-right">{formatCurrency(totalDebit)}</TableCell>
                                    <TableCell className="text-right pr-6">{formatCurrency(totalCredit)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            )}
        </Card>
    )
}

export default function Journals() {
    const [journals, setJournals] = useState<JournalEntry[]>([])
    // ... (rest of the component state is fine, just replacing the return block mostly)

    // ... (keep fetchJournals and other hooks)
    const [filteredJournals, setFilteredJournals] = useState<JournalEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const location = useLocation()

    const filterJournals = useCallback(() => {
        let filtered = [...journals]

        // Filter by search term (memo or ref_type)
        if (searchTerm) {
            filtered = filtered.filter(j =>
                j.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
    }, [journals, searchTerm, startDate, endDate])

    useEffect(() => {
        fetchJournals()
        // Set default date range to current month
        const now = new Date()
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        setStartDate(firstDay.toISOString().split('T')[0])
        setEndDate(now.toISOString().split('T')[0])
    }, [])

    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const q = params.get('q')
        if (q) {
            setSearchTerm(q)
            setStartDate('')
            setEndDate('')
        }
    }, [location.search])

    useEffect(() => {
        filterJournals()
    }, [filterJournals])

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
            linesData?.forEach((line) => {
                if (!linesMap[line.journal_id]) {
                    linesMap[line.journal_id] = []
                }

                const account = Array.isArray(line.accounts) ? line.accounts[0] : line.accounts

                linesMap[line.journal_id].push({
                    id: line.id,
                    account_code: account?.code || '',
                    account_name: account?.name || '',
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
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to fetch journals'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    function getRefTypeBadge(refType: string) {
        const normalized = (refType || '').toUpperCase()
        const colors: { [key: string]: string } = {
            'SALES': 'bg-green-100 text-green-800',
            'PURCHASE': 'bg-blue-100 text-blue-800',
            'SALES_RETURN': 'bg-yellow-100 text-yellow-800',
            'RECEIPT': 'bg-purple-100 text-purple-800',
            'PAYMENT': 'bg-red-100 text-red-800',
            'ADJUSTMENT': 'bg-gray-100 text-gray-800'
        }
        return (
            <Badge className={colors[normalized] || 'bg-gray-100 text-gray-800'}>
                {normalized}
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
                <h2 className="hidden md:block text-3xl font-bold tracking-tight text-gray-900">Journal Entries</h2>
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
                    <span>Balanced count: {filteredJournals.filter(j => j.lines.reduce((s, l) => s + l.debit, 0) === j.lines.reduce((s, l) => s + l.credit, 0)).length}</span>
                </div>
            </div>

            {/* Journal List with Accordion */}
            <div className="space-y-4">
                {filteredJournals.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center text-gray-500">
                            <p className="text-lg flex items-center justify-center gap-2"><Icons.FileText className="w-5 h-5" /> No journal entries found</p>
                            <p className="text-sm mt-2">Journals are automatically created when transactions are posted</p>
                        </CardContent>
                    </Card>
                ) : (
                    filteredJournals.map((journal) => (
                        <JournalEntryItem
                            key={journal.id}
                            journal={journal}
                            formatCurrency={formatCurrency}
                            getRefTypeBadge={getRefTypeBadge}
                        />
                    ))
                )}
            </div>
        </div>
    )
}
