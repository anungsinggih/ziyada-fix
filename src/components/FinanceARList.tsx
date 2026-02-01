import { useEffect, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";

type AR = {
    id: string;
    invoice_date: string;
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

    async function fetchAR() {
        setLoading(true);
        const { data, error } = await supabase
            .from("ar_invoices")
            .select("*, customer:customers(name)")
            .gt("outstanding_amount", 0)
            .order("invoice_date", { ascending: true });

        if (!error) {
            setArList(data || []);
        }
        setLoading(false);
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchAR();
    }, [refreshTrigger]);



    return (
        <Card className="shadow-sm h-full">
            <CardHeader className="bg-green-50/50 border-b border-green-100">
                <CardTitle className="text-green-800">
                    Outstanding Invoices (Receivables)
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <ResponsiveTable minWidth="640px">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Outstanding</TableHead>
                                <TableHead>Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">Loading...</TableCell>
                                </TableRow>
                            ) : arList.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={5}
                                        className="text-center italic py-8 text-gray-500"
                                    >
                                        No outstanding invoices
                                    </TableCell>
                                </TableRow>
                            ) : (
                                arList.map((item) => (
                                    <TableRow
                                        key={item.id}
                                        className={selectedId === item.id ? "bg-blue-50" : ""}
                                    >
                                        <TableCell>{item.invoice_date}</TableCell>
                                        <TableCell className="font-medium">
                                            {item.customer?.name}
                                        </TableCell>
                                        <TableCell>{item.total_amount.toLocaleString()}</TableCell>
                                        <TableCell className="font-bold text-green-600">
                                            {item.outstanding_amount.toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                size="sm"
                                                variant={selectedId === item.id ? "primary" : "outline"}
                                                onClick={() =>
                                                    onSelect(item.id, item.outstanding_amount)
                                                }
                                                className="w-full sm:w-auto"
                                            >
                                                {selectedId === item.id ? "Selected" : "Select"}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </ResponsiveTable>
            </CardContent>
        </Card>
    );
}
