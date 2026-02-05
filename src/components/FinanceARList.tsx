import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "./ui/Table";
import { Button } from "./ui/Button";
import { ResponsiveTable } from './ui/ResponsiveTable';
import { Section } from "./ui/Section";
import { Icons } from "./ui/Icons";
import { Input } from "./ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";

type AR = {
    id: string;
    invoice_date: string;
    invoice_no: string;
    customer: { name: string };
    total_amount: number;
    outstanding_amount: number;
    status: string;
};

type Props = {
    selectedId: string;
    onSelect: (id: string, amount: number) => void;
    refreshTrigger: number;
};

export function FinanceARList({ selectedId, onSelect, refreshTrigger }: Props) {
    const [arList, setArList] = useState<AR[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    const fetchAR = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from("ar_invoices")
                .select("*, customer:customers(name)")
                .gt("outstanding_amount", 0)
                .order("invoice_date", { ascending: true });

            // Apply date filters
            if (dateFrom) query = query.gte("invoice_date", dateFrom);
            if (dateTo) query = query.lte("invoice_date", dateTo);

            const { data, error } = await query;

            if (error) throw error;

            let filtered = data || [];

            // Client-side search for related checks if basic OR query is hard
            if (search) {
                const q = search.toLowerCase();
                filtered = filtered.filter(item =>
                    (item.invoice_no?.toLowerCase().includes(q)) ||
                    (item.customer?.name?.toLowerCase().includes(q))
                );
            }

            setArList(filtered);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [search, dateFrom, dateTo]);

    useEffect(() => {
        fetchAR();
    }, [fetchAR, refreshTrigger]);

    return (
        <div className="space-y-6 h-full">
            {/* Filter Section */}
            <Section
                title="Filter Invoices"
                description="Find specific outstanding invoices."
                className="border-l-4 border-l-indigo-500"
            >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                    <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                        <Input
                            label="Search"
                            placeholder="Customer / Invoice No"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            containerClassName="!mb-0"
                        />
                    </div>
                    <div className="col-span-6 sm:col-span-3 lg:col-span-3">
                        <Input
                            label="From"
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            containerClassName="!mb-0"
                        />
                    </div>
                    <div className="col-span-6 sm:col-span-3 lg:col-span-3">
                        <Input
                            label="To"
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            containerClassName="!mb-0"
                        />
                    </div>
                    <div className="col-span-12 sm:col-span-6 lg:col-span-2">
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                                setSearch("");
                                setDateFrom("");
                                setDateTo("");
                            }}
                            icon={<Icons.Close className="w-4 h-4" />}
                        >
                            Clear
                        </Button>
                    </div>
                </div>
            </Section>

            {/* Results Card */}
            <Card className="h-full shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex justify-between items-center">
                        <span>Outstanding Invoices</span>
                        <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                            {arList.length} Found
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <ResponsiveTable minWidth="640px">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent bg-gray-50/50">
                                    <TableHead className="w-[120px]">Date</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Outstanding</TableHead>
                                    <TableHead className="w-[100px] text-center">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                                            <div className="flex justify-center items-center gap-2">
                                                <div className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                                                <span>Loading invoices...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : arList.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={5}
                                            className="text-center italic py-12 text-slate-500"
                                        >
                                            <div className="flex flex-col items-center gap-2">
                                                <Icons.CheckCircle className="w-8 h-8 text-emerald-400 opacity-50" />
                                                <span>No outstanding invoices. Good job!</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    arList.map((item) => (
                                        <TableRow
                                            key={item.id}
                                            className={`cursor-pointer transition-colors ${selectedId === item.id ? "bg-indigo-50 hover:bg-indigo-50 border-l-2 border-l-indigo-600" : "hover:bg-slate-50"}`}
                                            onClick={() => onSelect(item.id, item.outstanding_amount)}
                                        >
                                            <TableCell className="font-medium text-slate-700">{new Date(item.invoice_date).toLocaleDateString()}</TableCell>
                                            <TableCell className="font-medium text-slate-900">
                                                <div className="flex flex-col">
                                                    <span>{item.customer?.name}</span>
                                                    {item.invoice_no && <span className="text-xs text-slate-500">{item.invoice_no}</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right text-slate-600">{item.total_amount.toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-bold text-indigo-600">
                                                {item.outstanding_amount.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {selectedId === item.id ? (
                                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-600">
                                                        <Icons.Check className="w-4 h-4" />
                                                    </span>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 px-3 text-xs"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onSelect(item.id, item.outstanding_amount);
                                                        }}
                                                    >
                                                        Select
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </ResponsiveTable>
                </CardContent>
            </Card>
        </div>
    );
}
