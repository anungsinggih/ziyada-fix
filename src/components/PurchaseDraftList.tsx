import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { Button } from "./ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Icons } from "./ui/Icons";
import { StatusBadge } from "./ui/StatusBadge";
import { useNavigate } from "react-router-dom";

type PurchaseDraft = {
    id: string;
    purchase_date?: string;
    terms?: string;
    vendor?: { name?: string };
};

type Props = {
    refreshTrigger: number;
    onSuccess: (msg: string) => void;
    onError: (msg: string) => void;
};

export function PurchaseDraftList({ refreshTrigger, onSuccess, onError }: Props) {
    const [drafts, setDrafts] = useState<PurchaseDraft[]>([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const fetchDrafts = useCallback(async () => {
        const { data } = await supabase
            .from("purchases")
            .select("*, vendor:vendors(name)")
            .eq("status", "DRAFT")
            .order("created_at", { ascending: false });
        setDrafts(data || []);
    }, []);

    useEffect(() => {
        fetchDrafts();
    }, [fetchDrafts, refreshTrigger]);

    async function handlePost(purId: string) {
        if (!confirm("Confirm POST?")) return;
        setLoading(true);
        try {
            const { error } = await supabase.rpc("rpc_post_purchase", {
                p_purchase_id: purId,
            });
            if (error) throw error;
            onSuccess("Purchase POSTED!");
            navigate(`/purchases/${purId}`);
        } catch (err: unknown) {
            if (err instanceof Error) onError(err.message);
            else onError('Unknown error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Card className="h-full shadow-md border-gray-200 flex flex-col">
            <CardHeader className="bg-yellow-50/50 border-b border-yellow-100 pb-4">
                <CardTitle className="text-yellow-800 flex items-center gap-2">
                    <Icons.FileText className="w-5 h-5" /> Pending Drafts
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 max-h-[600px]">
                {drafts.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-10 italic">
                        No pending drafts.
                    </p>
                ) : (
                    <ul className="space-y-4">
                        {drafts.map((d) => (
                            <li
                                key={d.id}
                                className="p-4 border border-gray-100 rounded-lg hover:border-purple-300 hover:shadow-md transition-all bg-white"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <div className="font-bold text-gray-900">
                                            {d.vendor?.name}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                            <Icons.Calendar className="w-3 h-3" />{" "}
                                            {d.purchase_date}
                                        </div>
                                    </div>
                                    <StatusBadge status="DRAFT" />
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                                    <Button
                                        type="button"
                                        onClick={() => handlePost(d.id)}
                                        disabled={loading}
                                        className="w-full sm:w-auto min-h-[44px] bg-blue-600 hover:bg-blue-700"
                                        icon={<Icons.Check className="w-4 h-4" />}
                                    >
                                        POST Purchase
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
