import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { Button } from "./ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Badge } from "./ui/Badge";

type DraftReturn = {
    id: string
    return_date: string
    sales?: {
        sales_no: string
        customer?: { name: string }
    }
}

type Props = {
    refreshTrigger: number;
    onSuccess: (msg: string) => void;
    onError: (msg: string) => void;
};

export function SalesReturnDraftList({ refreshTrigger, onSuccess, onError }: Props) {
    const [drafts, setDrafts] = useState<DraftReturn[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchDraftReturns = useCallback(async () => {
        const { data } = await supabase
            .from('sales_returns')
            .select('*, sales(sales_no, customer:customers(name))')
            .eq('status', 'DRAFT')
            .order('created_at', { ascending: false })
        setDrafts(data || [])
    }, []);

    useEffect(() => {
        fetchDraftReturns();
    }, [fetchDraftReturns, refreshTrigger]);

    async function handlePost(retId: string) {
        if (!confirm("Confirm POST Return? This handles Stock & Journals.")) return
        setLoading(true)
        try {
            const { error } = await supabase.rpc('rpc_post_sales_return', { p_return_id: retId })
            if (error) throw error
            onSuccess("Return POSTED Successfully!")
        } catch (err: unknown) {
            if (err instanceof Error) onError(err.message)
            else onError('Unknown error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="sticky top-6">
            <CardHeader className="bg-yellow-50/50 border-b border-yellow-100">
                <CardTitle className="text-yellow-800">Pending Drafts</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {drafts.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 italic">No pending drafts</div>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {drafts.map(d => (
                            <li key={d.id} className="p-4 hover:bg-gray-50 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <Badge variant="warning" className="mb-1">DRAFT</Badge>
                                        <div className="text-sm font-medium text-gray-900">{d.sales?.customer?.name}</div>
                                        <div className="text-xs text-gray-500">Ref: {d.sales?.sales_no}</div>
                                        <div className="text-xs text-gray-400">{d.return_date}</div>
                                    </div>
                                </div>
                                <Button size="sm" variant="primary" className="w-full mt-2" onClick={() => handlePost(d.id)} disabled={loading}>
                                    🚀 Post Return
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
