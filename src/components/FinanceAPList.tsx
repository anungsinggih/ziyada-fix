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
import { ResponsiveTable } from './ui/ResponsiveTable'
import { Button } from "./ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";

type AP = {
    id: string;
    bill_date: string;
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

    async function fetchAP() {
        setLoading(true);
        const { data, error } = await supabase
            .from("ap_bills")
            .select("*, vendor:vendors(name)")
            .gt("outstanding_amount", 0)
            .order("bill_date", { ascending: true });

        if (!error) {
            setApList(data || []);
        }
        setLoading(false);
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchAP();
    }, [refreshTrigger]);



    return (
        <Card className="shadow-sm h-full">
            <CardHeader className="bg-red-50/50 border-b border-red-100">
                <CardTitle className="text-red-800">Unpaid Bills (Payables)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <ResponsiveTable minWidth="640px">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Vendor</TableHead>
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
                            ) : apList.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={5}
                                        className="text-center italic py-8 text-gray-500"
                                    >
                                        No unpaid bills
                                    </TableCell>
                                </TableRow>
                            ) : (
                                apList.map((item) => (
                                    <TableRow
                                        key={item.id}
                                        className={selectedId === item.id ? "bg-red-50" : ""}
                                    >
                                        <TableCell>{item.bill_date}</TableCell>
                                        <TableCell className="font-medium">
                                            {item.vendor?.name}
                                        </TableCell>
                                        <TableCell>{item.total_amount.toLocaleString()}</TableCell>
                                        <TableCell className="font-bold text-red-600">
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
