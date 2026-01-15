import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs'
import { Card, CardContent } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Icons } from './ui/Icons'

type AccountBalance = {
    id: string
    code: string
    name: string
    opening_balance: number
    debit_movement: number
    credit_movement: number
    closing_balance: number
}

type GLLine = {
    journal_date: string
    ref_type: string
    ref_no: string
    memo: string
    debit: number
    credit: number
}

type CashflowLine = {
    category: string
    description: string
    amount: number
}

type Account = { id: string, name: string, code: string }

export default function Reporting() {
    const [startDate, setStartDate] = useState(new Date().getFullYear() + '-01-01')
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<AccountBalance[]>([])
    const [error, setError] = useState<string | null>(null)

    // GL State
    const [glAccount, setGlAccount] = useState('')
    const [glData, setGlData] = useState<GLLine[]>([])
    const [accounts, setAccounts] = useState<Account[]>([])

    // Cashflow State
    const [cashflowData, setCashflowData] = useState<CashflowLine[]>([])

    // Active tab tracking
    const [activeTab, setActiveTab] = useState('TB')

    // Trigger fetch on tab change not needed if we pre-fetch or fetch on button
    // But for GL account list we need it.
    // Let's load accounts once on mount
    useEffect(() => {
        fetchAccounts()
    }, [])

    async function fetchAccounts() {
        const { data } = await supabase.from('accounts').select('id, name, code').order('code')
        setAccounts(data || [])
    }

    async function handleRunReport(tabName?: string) {
        const tab = tabName || activeTab
        setLoading(true)
        setError(null)
        setData([])
        setGlData([])
        setCashflowData([])

        try {
            if (tab === 'GL') {
                if (!glAccount) { setError("Select Account"); setLoading(false); return }
                const { data, error } = await supabase.rpc('rpc_get_gl', {
                    p_account_id: glAccount,
                    p_start_date: startDate,
                    p_end_date: endDate
                })
                if (error) throw error
                setGlData(data || [])
            } else if (tab === 'CF') {
                const { data, error } = await supabase.rpc('rpc_get_cashflow', {
                    p_start_date: startDate,
                    p_end_date: endDate
                })
                if (error) throw error
                setCashflowData(data || [])
            } else {
                // TB, BS, PL rely on Balances
                const { data, error } = await supabase.rpc('rpc_get_account_balances', {
                    p_start_date: startDate,
                    p_end_date: endDate
                })
                if (error) throw error
                setData(data || [])
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // UTILS
    const fmt = (n: number) => n?.toLocaleString('id-ID', { minimumFractionDigits: 2 })

    // Balance Sheet Logic
    const assets = data.filter(d => d.code.startsWith('1'))
    const liabs = data.filter(d => d.code.startsWith('2'))
    const equity = data.filter(d => d.code.startsWith('3'))

    // P&L Logic
    const revenue = data.filter(d => d.code.startsWith('4'))
    const cogs = data.filter(d => d.code.startsWith('5'))
    const expense = data.filter(d => d.code.startsWith('6') || d.code.startsWith('7') || d.code.startsWith('8') || d.code.startsWith('9'))

    const sum = (list: AccountBalance[]) => list.reduce((acc, curr) => acc + curr.closing_balance, 0)
    const retainedEarnings = sum(revenue) + sum(cogs) + sum(expense)
    const totalAsset = sum(assets)
    const totalLiab = -sum(liabs)
    const totalEquity = -sum(equity) + (-retainedEarnings)

    return (
        <div className="w-full">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-8">Financial Reports</h2>

            <Tabs defaultValue="TB" onValueChange={(val) => setActiveTab(val)}>
                <div className="flex flex-col gap-4 mb-8">
                    <TabsList className="flex flex-wrap gap-2 overflow-x-auto w-full rounded-lg bg-white border border-gray-100 shadow-sm p-1">
                        <TabsTrigger value="TB" className="min-w-[80px] flex-1 sm:flex-auto flex items-center gap-1 justify-center"><Icons.FileText className="w-4 h-4" /> TB</TabsTrigger>
                        <TabsTrigger value="BS" className="min-w-[80px] flex-1 sm:flex-auto flex items-center gap-1 justify-center"><Icons.Chart className="w-4 h-4" /> BS</TabsTrigger>
                        <TabsTrigger value="PL" className="min-w-[80px] flex-1 sm:flex-auto flex items-center gap-1 justify-center"><Icons.Chart className="w-4 h-4" /> PL</TabsTrigger>
                        <TabsTrigger value="CF" className="min-w-[80px] flex-1 sm:flex-auto flex items-center gap-1 justify-center"><Icons.DollarSign className="w-4 h-4" /> CF</TabsTrigger>
                        <TabsTrigger value="GL" className="min-w-[80px] flex-1 sm:flex-auto flex items-center gap-1 justify-center"><Icons.FileText className="w-4 h-4" /> GL</TabsTrigger>
                    </TabsList>

                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 w-full">
                            <Input type="date" label="Start" value={startDate} onChange={e => setStartDate(e.target.value)} containerClassName="w-full" />
                            <Input type="date" label="End" value={endDate} onChange={e => setEndDate(e.target.value)} containerClassName="w-full" />
                        </div>
                        <Button onClick={() => handleRunReport()} disabled={loading} className="w-full sm:w-auto">Run Report</Button>
                    </div>
                </div>

                {error && <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-lg flex items-center gap-2"><Icons.Warning className="w-5 h-5 flex-shrink-0" /> {error}</div>}
                {loading && <div className="text-center py-10 text-gray-500">Loading Report Data...</div>}

                <TabsContent value="TB">
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="bg-gray-50 text-gray-700 uppercase">
                                        <tr><th className="px-6 py-3">Code</th><th className="px-6 py-3">Name</th><th className="px-6 py-3 text-right">Opening</th><th className="px-6 py-3 text-right">Debit</th><th className="px-6 py-3 text-right">Credit</th><th className="px-6 py-3 text-right">Closing</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {data.map(d => (
                                            <tr key={d.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-3 font-medium text-gray-900">{d.code}</td>
                                                <td className="px-6 py-3">{d.name}</td>
                                                <td className="px-6 py-3 text-right text-gray-500">{fmt(d.opening_balance)}</td>
                                                <td className="px-6 py-3 text-right text-green-600">{fmt(d.debit_movement)}</td>
                                                <td className="px-6 py-3 text-right text-red-600">{fmt(d.credit_movement)}</td>
                                                <td className="px-6 py-3 text-right font-bold">{fmt(d.closing_balance)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="PL">
                    <Card className="max-w-3xl mx-auto">
                        <CardContent className="p-8 space-y-6">
                            <div className="text-center mb-8"><h3 className="text-xl font-bold">Income Statement</h3><p className="text-gray-500">{startDate} to {endDate}</p></div>
                            <div>
                                <h4 className="font-semibold text-gray-900 border-b pb-2 mb-2">Revenue</h4>
                                {revenue.map(d => <div key={d.id} className="flex justify-between py-1"><span>{d.code} {d.name}</span><span>{fmt(-d.closing_balance)}</span></div>)}
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-900 border-b pb-2 mb-2 mt-4">COGS</h4>
                                {cogs.map(d => <div key={d.id} className="flex justify-between py-1"><span>{d.code} {d.name}</span><span>{fmt(d.closing_balance)}</span></div>)}
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-900 border-b pb-2 mb-2 mt-4">Expenses</h4>
                                {expense.map(d => <div key={d.id} className="flex justify-between py-1"><span>{d.code} {d.name}</span><span>{fmt(d.closing_balance)}</span></div>)}
                            </div>
                            <div className="flex justify-between font-bold text-lg pt-4 border-t-2 border-gray-900 mt-4">
                                <span>Net Income</span>
                                <span className={retainedEarnings < 0 ? 'text-green-600' : 'text-red-600'}>{fmt(-retainedEarnings)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="BS">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardContent className="p-6">
                                <h3 className="font-bold text-lg mb-4 text-blue-600">Assets</h3>
                                {assets.map(d => <div key={d.id} className="flex justify-between py-1 border-b border-gray-50 last:border-0"><span>{d.code} {d.name}</span><span className="font-mono">{fmt(d.closing_balance)}</span></div>)}
                                <div className="flex justify-between font-bold mt-4 pt-4 border-t"><span>Total Assets</span><span>{fmt(totalAsset)}</span></div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-6">
                                <h3 className="font-bold text-lg mb-4 text-purple-600">Liabilities & Equity</h3>
                                <h4 className="font-semibold text-sm uppercase text-gray-500 mb-2">Liabilities</h4>
                                {liabs.map(d => <div key={d.id} className="flex justify-between py-1 border-b border-gray-50 last:border-0"><span>{d.code} {d.name}</span><span className="font-mono">{fmt(-d.closing_balance)}</span></div>)}

                                <h4 className="font-semibold text-sm uppercase text-gray-500 mb-2 mt-4">Equity</h4>
                                {equity.map(d => <div key={d.id} className="flex justify-between py-1 border-b border-gray-50 last:border-0"><span>{d.code} {d.name}</span><span className="font-mono">{fmt(-d.closing_balance)}</span></div>)}
                                <div className="flex justify-between py-1 text-blue-600"><span>Current Year Earnings</span><span className="font-mono">{fmt(-retainedEarnings)}</span></div>

                                <div className="flex justify-between font-bold mt-4 pt-4 border-t"><span>Total Liab & Equity</span><span>{fmt(totalLiab + totalEquity)}</span></div>

                                <div className={`text-center mt-4 text-xs font-bold py-1 px-2 rounded ${Math.abs(totalAsset - (totalLiab + totalEquity)) < 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {Math.abs(totalAsset - (totalLiab + totalEquity)) < 1 ? 'Balanced' : 'Unbalanced'}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="GL">
                    <Card>
                        <div className="p-4 border-b bg-gray-50">
                            <Select
                                label="Select Account to View"
                                value={glAccount}
                                onChange={e => setGlAccount(e.target.value)}
                                options={[
                                    { label: "-- Choose Account --", value: "" },
                                    ...accounts.map(a => ({ label: `${a.code} - ${a.name}`, value: a.id }))
                                ]}
                            />
                            <div className="mt-2 text-right"><Button size="sm" onClick={() => handleRunReport('GL')}>Load Transactions</Button></div>
                        </div>
                        <CardContent className="p-0 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-700 uppercase"><tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">Ref</th><th className="px-6 py-3">Memo</th><th className="px-6 py-3 text-right">Debit</th><th className="px-6 py-3 text-right">Credit</th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {glData.map((row, i) => (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="px-6 py-3">{row.journal_date || row.ref_type}</td>
                                            <td className="px-6 py-3 font-mono text-xs">{row.ref_no}</td>
                                            <td className="px-6 py-3">{row.memo}</td>
                                            <td className="px-6 py-3 text-right">{fmt(row.debit)}</td>
                                            <td className="px-6 py-3 text-right">{fmt(row.credit)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="CF">
                    <Card>
                        <CardContent className="p-6">
                            <h3 className="text-xl font-bold mb-4">Cash Flow Statement</h3>
                            {cashflowData.length === 0 ? (
                                <div className="py-12 text-center text-gray-500">
                                    <p className="text-lg flex items-center justify-center gap-2"><Icons.Chart className="w-6 h-6 text-gray-400" /> No cashflow data</p>
                                    <p className="text-sm mt-2">Select a date range and click "Run Report"</p>
                                    <p className="text-xs mt-1 text-gray-400">Debug: cashflowData.length = {cashflowData.length}</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {cashflowData.map((line, idx) => {
                                        const isTotal = line.category === 'Closing'
                                        const isNegative = line.amount < 0
                                        return (
                                            <div key={idx} className={`flex justify-between py-2 border-b ${isTotal ? 'font-bold text-lg border-t-2 border-gray-800 pt-3' : ''
                                                }`}>
                                                <span className="flex gap-2">
                                                    <span className="text-gray-500 w-20">{line.category}</span>
                                                    <span className={isTotal ? 'text-gray-900' : 'text-gray-600'}>{line.description}</span>
                                                </span>
                                                <span className={`font-mono ${isTotal ? 'text-blue-700' :
                                                    isNegative ? 'text-red-600' : 'text-green-600'
                                                    }`}>
                                                    {fmt(line.amount)}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
