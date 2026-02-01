import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/Table";
import { Button } from "./ui/Button";
import { Alert } from "./ui/Alert";
import { StatusBadge } from "./ui/StatusBadge";
import { Badge } from "./ui/Badge";
import { Icons } from "./ui/Icons";
import { ResponsiveTable } from "./ui/ResponsiveTable";
import { EmptyState } from "./ui/EmptyState";
import { formatCurrency, formatDate, safeDocNo } from "../lib/format";

type PurchaseRecord = {
  id: string;
  purchase_date: string;
  purchase_no: string | null;
  vendor_id: string;
  vendor_name: string;
  terms: "CASH" | "CREDIT";
  total_amount: number;
  status: "DRAFT" | "POSTED" | "VOID";
  created_at: string;
};

export default function PurchaseHistory() {
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [postingId, setPostingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPurchases();
  }, []);

  async function fetchPurchases() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("purchases")
        .select(
          `
                    id,
                    purchase_date,
                    purchase_no,
                    vendor_id,
                    terms,
                    total_amount,
                    status,
                    created_at,
                    vendors (
                        name
                    )
                `,
        )
        .order("purchase_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      const enriched =
        data?.map((purchase) => ({
          ...purchase,
          vendor_name: (purchase.vendors as unknown as { name: string })?.name || "Unknown",
        })) || [];

      setPurchases(enriched);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message || "Failed to fetch purchases");
    } finally {
      setLoading(false);
    }
  }

  async function handlePost(purchaseId: string) {
    if (
      !confirm(
        "Are you sure you want to POST this purchase? This action cannot be undone.",
      )
    ) {
      return;
    }

    setPostingId(purchaseId);
    setError(null);
    setSuccess(null);

    try {
      const { error: rpcError } = await supabase.rpc("rpc_post_purchase", {
        p_purchase_id: purchaseId,
      });

      if (rpcError) {
        if (rpcError.message?.includes("CLOSED")) {
          throw new Error("Cannot POST: Period is CLOSED for this date");
        } else {
          throw rpcError;
        }
      }

      setSuccess("Purchase posted successfully!");
      navigate(`/purchases/${purchaseId}`);
    } catch (err: unknown) {
      setSuccess(null);
      if (err instanceof Error) setError(err.message || "Failed to post purchase");
    } finally {
      setPostingId(null);
    }
  }

  if (loading) {
    return (
      <div className="w-full p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-2 text-gray-600">Loading purchases...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="hidden md:block text-3xl font-bold tracking-tight text-gray-900">
          Purchase History
        </h2>
        <div className="flex gap-2">
          <Button
            onClick={fetchPurchases}
            variant="outline"
            icon={<Icons.Refresh className="w-4 h-4" />}
          >
            Refresh
          </Button>
          <Button
            onClick={() => navigate("/purchases")}
            icon={<Icons.Plus className="w-4 h-4" />}
          >
            New Purchase
          </Button>
        </div>
      </div>

      {error && <Alert variant="error" title="Kesalahan" description={error} />}
      {success && (
        <Alert variant="success" title="Sukses" description={success} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Purchase Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <EmptyState
              icon={<Icons.FileText className="w-5 h-5" />}
              title="No purchase records found"
              description="Create your first purchase to get started"
            />
          ) : (
            <ResponsiveTable minWidth="640px">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Doc No</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Terms</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell>{formatDate(purchase.purchase_date)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {safeDocNo(purchase.purchase_no, purchase.id)}
                      </TableCell>
                      <TableCell>{purchase.vendor_name}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            purchase.terms === "CASH"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-orange-100 text-orange-800"
                          }
                        >
                          {purchase.terms}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(purchase.total_amount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={purchase.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigate(`/purchases/${purchase.id}`)
                            }
                            icon={<Icons.Eye className="w-4 h-4" />}
                          >
                            View
                          </Button>
                          {purchase.status === "DRAFT" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  navigate(`/purchases/${purchase.id}/edit`)
                                }
                                icon={<Icons.Edit className="w-4 h-4" />}
                                className="w-full sm:w-auto"
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handlePost(purchase.id)}
                                disabled={postingId === purchase.id}
                                isLoading={postingId === purchase.id}
                                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                                icon={<Icons.Check className="w-4 h-4" />}
                              >
                                POST
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
