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
import { Icons } from './ui/Icons'
import { ResponsiveTable } from './ui/ResponsiveTable';
import { EmptyState } from "./ui/EmptyState";
import { formatCurrency, formatDate, safeDocNo } from "../lib/format";

type SalesRecord = {
  id: string;
  sales_date: string;
  sales_no: string | null;
  customer_id: string;
  customer_name: string;
  terms: "CASH" | "CREDIT";
  total_amount: number;
  status: "DRAFT" | "POSTED" | "VOID";
  created_at: string;
};

export default function SalesHistory() {
  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [postingId, setPostingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSales();
  }, []);

  async function fetchSales() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("sales")
        .select(
          `
                    id,
                    sales_date,
                    sales_no,
                    customer_id,
                    terms,
                    total_amount,
                    status,
                    created_at,
                    customers (
                        name
                    )
                `,
        )
        .order("sales_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      const enriched =
        data?.map((sale) => ({
          ...sale,
          customer_name: (sale.customers as unknown as { name: string })?.name || "Unknown",
        })) || [];

      setSales(enriched);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message || "Failed to fetch sales");
    } finally {
      setLoading(false);
    }
  }

  async function handlePost(saleId: string) {
    if (
      !confirm(
        "Are you sure you want to POST this sales? This action cannot be undone.",
      )
    ) {
      return;
    }

    setPostingId(saleId);
    setError(null);
    setSuccess(null);

    try {
      const { error: rpcError } = await supabase.rpc("rpc_post_sales", {
        p_sales_id: saleId,
      });

      if (rpcError) {
        if (rpcError.message?.includes("CLOSED")) {
          throw new Error("Cannot POST: Period is CLOSED for this date");
        } else if (rpcError.message?.includes("stock")) {
          throw new Error("Insufficient stock for one or more items");
        } else {
          throw rpcError;
        }
      }

      setSuccess("Sales posted successfully!");
      navigate(`/sales/${saleId}`);
    } catch (err: unknown) {
      setSuccess(null);
      if (err instanceof Error) setError(err.message || "Failed to post sales");
    } finally {
      setPostingId(null);
    }
  }

  if (loading) {
    return (
      <div className="w-full p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-2 text-gray-600">Loading sales...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="hidden md:block text-3xl font-bold tracking-tight text-gray-900">
          Sales History
        </h2>
        <div className="flex gap-2">
          <Button
            onClick={fetchSales}
            variant="outline"
            icon={<Icons.Refresh className="w-4 h-4" />}
          >
            Refresh
          </Button>
          <Button
            onClick={() => navigate("/sales")}
            icon={<Icons.Plus className="w-4 h-4" />}
          >
            New Sales
          </Button>
        </div>
      </div>

      {error && <Alert variant="error" title="Kesalahan" description={error} />}
      {success && (
        <Alert variant="success" title="Sukses" description={success} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Sales Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <EmptyState
              icon={<Icons.FileText className="w-5 h-5" />}
              title="No sales records found"
              description="Create your first sale to get started"
            />
          ) : (
            <ResponsiveTable minWidth="640px">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Doc No</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Terms</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>{formatDate(sale.sales_date)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {safeDocNo(sale.sales_no, sale.id)}
                      </TableCell>
                      <TableCell>{sale.customer_name}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            sale.terms === "CASH"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-orange-100 text-orange-800"
                          }
                        >
                          {sale.terms}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(sale.total_amount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={sale.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/sales/${sale.id}`)}
                            icon={<Icons.Eye className="w-4 h-4" />}
                          >
                            View
                          </Button>
                          {sale.status === "DRAFT" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/sales/${sale.id}/edit`)}
                                icon={<Icons.Edit className="w-4 h-4" />}
                                className="w-full sm:w-auto"
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handlePost(sale.id)}
                                disabled={postingId === sale.id}
                                isLoading={postingId === sale.id}
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
