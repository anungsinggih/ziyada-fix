import { useEffect, useState, useCallback } from "react";
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
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Alert } from "./ui/Alert";
import { StatusBadge } from "./ui/StatusBadge";
import { Badge } from "./ui/Badge";
import { Icons } from "./ui/Icons";
import { ResponsiveTable } from "./ui/ResponsiveTable";
import { EmptyState } from "./ui/EmptyState";
import { formatCurrency, formatDate, safeDocNo } from "../lib/format";
import { usePagination } from "../hooks/usePagination";
import { Pagination } from "./ui/Pagination";

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "DRAFT" | "POSTED" | "VOID">("ALL");
  const [termsFilter, setTermsFilter] = useState<"ALL" | "CASH" | "CREDIT">("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const navigate = useNavigate();

  const { page, setPage, pageSize, range } = usePagination();
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, termsFilter, dateFrom, dateTo, setPage]);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let query = supabase
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
          { count: "exact" }
        )
        .order("purchase_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (statusFilter !== "ALL") {
        query = query.eq("status", statusFilter);
      }
      if (termsFilter !== "ALL") {
        query = query.eq("terms", termsFilter);
      }
      if (dateFrom) {
        query = query.gte("purchase_date", dateFrom);
      }
      if (dateTo) {
        query = query.lte("purchase_date", dateTo);
      }
      if (search.trim()) {
        const q = search.trim();
        query = query.or(`purchase_no.ilike.%${q}%,vendors.name.ilike.%${q}%`);
      }

      query = query.range(range[0], range[1]);

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      const enriched =
        data?.map((purchase) => ({
          ...purchase,
          vendor_name: (purchase.vendors as unknown as { name: string })?.name || "Unknown",
        })) || [];

      setPurchases(enriched);
      setTotalCount(count || 0);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message || "Failed to fetch purchases");
    } finally {
      setLoading(false);
    }
  }, [range, search, statusFilter, termsFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

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
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end">
            <div className="md:w-[260px]">
              <Input
                label="Search"
                placeholder="Doc No / Vendor"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                containerClassName="!mb-0"
              />
            </div>
            <div className="md:w-[150px]">
              <Input
                label="From"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                containerClassName="!mb-0"
              />
            </div>
            <div className="md:w-[150px]">
              <Input
                label="To"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                containerClassName="!mb-0"
              />
            </div>
            <div className="md:w-[150px]">
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "ALL" | "DRAFT" | "POSTED" | "VOID")}
                options={[
                  { label: "All", value: "ALL" },
                  { label: "Draft", value: "DRAFT" },
                  { label: "Posted", value: "POSTED" },
                  { label: "Void", value: "VOID" },
                ]}
                className="!mb-0"
              />
            </div>
            <div className="md:w-[150px]">
              <Select
                label="Terms"
                value={termsFilter}
                onChange={(e) => setTermsFilter(e.target.value as "ALL" | "CASH" | "CREDIT")}
                options={[
                  { label: "All", value: "ALL" },
                  { label: "Cash", value: "CASH" },
                  { label: "Credit", value: "CREDIT" },
                ]}
                className="!mb-0"
              />
            </div>
            <div className="md:w-auto">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-transparent">Action</label>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                    setTermsFilter("ALL");
                    setDateFrom("");
                    setDateTo("");
                  }}
                  aria-label="Clear filters"
                  title="Clear filters"
                  icon={<Icons.Close className="w-4 h-4" />}
                >
                  Clear Filter
                </Button>
              </div>
            </div>
          </div>

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
                            size="icon"
                            variant="outline"
                            onClick={() =>
                              navigate(`/purchases/${purchase.id}`)
                            }
                            icon={<Icons.Eye className="w-4 h-4" />}
                            aria-label="View purchase"
                            title="View"
                          />
                          {purchase.status === "DRAFT" && (
                            <>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() =>
                                  navigate(`/purchases/${purchase.id}/edit`)
                                }
                                icon={<Icons.Edit className="w-4 h-4" />}
                                className="w-full sm:w-auto"
                                aria-label="Edit purchase"
                                title="Edit"
                              />
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
              <Pagination
                currentPage={page}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={setPage}
                isLoading={loading}
              />
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
