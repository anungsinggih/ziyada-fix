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
import { ResponsiveTable } from './ui/ResponsiveTable'
import { Button } from "./ui/Button";
import { Section } from "./ui/Section";
import { Icons } from "./ui/Icons";
import { Input } from "./ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";

type AP = {
    id: string;
    bill_date: string;
    bill_no: string;
    vendor: { name: string };
    total_amount: number;
    outstanding_amount: number;
    status: string;
};

type Props = {
    selectedId: string;
    onSelect: (id: string, amount: number) => void;
    refreshTrigger: number;
};

export function FinanceAPList({ selectedId, onSelect, refreshTrigger }: Props) {
    const [apList, setApList] = useState<AP[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    const fetchAP = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from("ap_bills")
                .select("*, vendor:vendors(name)")
                .gt("outstanding_amount", 0)
                .order("bill_date", { ascending: true });

            if (dateFrom) query = query.gte("bill_date", dateFrom);
            if (dateTo) query = query.lte("bill_date", dateTo);

            const { data, error } = await query;
            if (error) throw error;

            let filtered = data || [];

            if (search) {
                const q = search.toLowerCase();
                filtered = filtered.filter(item =>
                    (item.bill_no?.toLowerCase().includes(q)) ||
                    (item.vendor?.name?.toLowerCase().includes(q))
                );
            }

            setApList(filtered);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [search, dateFrom, dateTo]);

    useEffect(() => {
        fetchAP();
    }, [fetchAP, refreshTrigger]);

    return (
        <div className="space-y-6 h-full">
            {/* Filter Section */}
            <Section
                title="Filter Bills"
                description="Find unpaid bills."
                className="border-l-4 border-l-rose-500"
            >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                    <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                        <Input
                            label="Search"
                            placeholder="Vendor / Bill No"
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
                        <span>Unpaid Bills</span>
                        <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                            {apList.length} Found
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <ResponsiveTable minWidth="640px">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent bg-gray-50/50">
                                    <TableHead className="w-[120px]">Date</TableHead>
                                    <TableHead>Vendor</TableHead>
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
                                                <div className="animate-spin w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full"></div>
                                                <span>Loading bills...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : apList.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={5}
                                            className="text-center italic py-12 text-slate-500"
                                        >
                                            <div className="flex flex-col items-center gap-2">
                                                <Icons.CheckCircle className="w-8 h-8 text-emerald-400 opacity-50" />
                                                <span>No unpaid bills. Excellent!</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    apList.map((item) => (
                                        <TableRow
                                            key={item.id}
                                            className={`cursor-pointer transition-colors ${selectedId === item.id ? "bg-rose-50 hover:bg-rose-50 border-l-2 border-l-rose-600" : "hover:bg-slate-50"}`}
                                            onClick={() => onSelect(item.id, item.outstanding_amount)}
                                        >
                                            <TableCell className="font-medium text-slate-700">{new Date(item.bill_date).toLocaleDateString()}</TableCell>
                                            <TableCell className="font-medium text-slate-900">
                                                <div className="flex flex-col">
                                                    <span>{item.vendor?.name}</span>
                                                    {item.bill_no && <span className="text-xs text-slate-500">{item.bill_no}</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right text-slate-600">{item.total_amount.toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-bold text-rose-600">
                                                {item.outstanding_amount.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {selectedId === item.id ? (
                                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-600">
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
