import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate, useParams } from "react-router-dom";
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
import { Badge } from "./ui/Badge";
import { Alert } from "./ui/Alert";
import { Icons } from "./ui/Icons";

type PurchaseDetail = {
  id: string;
  purchase_date: string;
  purchase_no: string | null;
  vendor_id: string;
  vendor_name: string;
  terms: "CASH" | "CREDIT";
  total_amount: number;
  status: "DRAFT" | "POSTED" | "VOID";
  notes: string | null;
  created_at: string;
};

type PurchaseItem = {
  id: string;
  item_id: string;
  item_name: string;
  sku: string;
  uom_snapshot: string;
  qty: number;
  unit_cost: number;
  subtotal: number;
};

type RelatedDoc = {
  journal_id?: string;
  journal_date?: string;
  ap_bill_id?: string;
  ap_total?: number;
  ap_outstanding?: number;
  ap_status?: string;
};

export default function PurchaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [relatedDocs, setRelatedDocs] = useState<RelatedDoc>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPurchaseDetail(id);
    }
  }, [id]);

  async function fetchPurchaseDetail(purchaseId: string) {
    setLoading(true);
    setError(null);

    try {
      // Fetch header
      const { data: purchaseData, error: purchaseError } = await supabase
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
                    notes,
                    created_at,
                    vendors (
                        name
                    )
                `,
        )
        .eq("id", purchaseId)
        .single();

      if (purchaseError) throw purchaseError;

      setPurchase({
        ...purchaseData,
        vendor_name: (purchaseData.vendors as any)?.name || "Unknown",
      });

      // Fetch items
      const { data: itemsData, error: itemsError } = await supabase
        .from("purchase_items")
        .select(
          `
                    id,
                    item_id,
                    qty,
                    unit_cost,
                    subtotal,
                    uom_snapshot,
                    items (
                        name,
                        sku
                    )
                `,
        )
        .eq("purchase_id", purchaseId);

      if (itemsError) throw itemsError;

      setItems(
        itemsData?.map((item) => ({
          ...item,
          item_name: (item.items as any)?.name || "Unknown",
          sku: (item.items as any)?.sku || "",
        })) || [],
      );

      // Fetch related documents (only if POSTED)
      if (purchaseData.status === "POSTED") {
        const related: RelatedDoc = {};

        // Journal
        const { data: journalData } = await supabase
          .from("journals")
          .select("id, journal_date")
          .eq("ref_type", "PURCHASE")
          .eq("ref_id", purchaseId)
          .single();

        if (journalData) {
          related.journal_id = journalData.id;
          related.journal_date = journalData.journal_date;
        }

        // AP Bill (if CREDIT)
        if (purchaseData.terms === "CREDIT") {
          const { data: apData } = await supabase
            .from("ap_bills")
            .select("id, total_amount, outstanding_amount, status")
            .eq("purchase_id", purchaseId)
            .single();

          if (apData) {
            related.ap_bill_id = apData.id;
            related.ap_total = apData.total_amount;
            related.ap_outstanding = apData.outstanding_amount;
            related.ap_status = apData.status;
          }
        }

        setRelatedDocs(related);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch purchase detail");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteDraft() {
    if (!purchase) return;
    if (!confirm("Hapus draft ini? Tindakan ini tidak bisa dibatalkan."))
      return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      const { error } = await supabase.rpc("rpc_delete_purchase_draft", {
        p_purchase_id: purchase.id,
      });
      if (error) throw error;
      setDeleteSuccess("Draft berhasil dihapus, kembali ke daftar...");
      setTimeout(() => navigate("/purchases/history"), 700);
    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setIsDeleting(false);
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  }

  function getStatusBadge(status: string) {
    const colors = {
      DRAFT: "bg-gray-100 text-gray-800",
      POSTED: "bg-green-100 text-green-800",
      VOID: "bg-red-100 text-red-800",
    };
    return (
      <Badge className={colors[status as keyof typeof colors] || "bg-gray-100"}>
        {status}
      </Badge>
    );
  }

  if (loading) {
    return (
      <div className="w-full p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-2 text-gray-600">Loading purchase detail...</p>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="w-full p-8">
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center gap-2">
          <Icons.Warning className="w-5 h-5 flex-shrink-0" />{" "}
          {error || "Purchase not found"}
        </div>
        <Button
          onClick={() => navigate("/purchases/history")}
          className="mt-4"
          icon={<Icons.ArrowLeft className="w-4 h-4" />}
        >
          Back to List
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            Purchase Detail
          </h2>
          <div className="flex gap-2 no-print flex-wrap">
            <Button
              onClick={() => window.print()}
              variant="outline"
              icon={<Icons.Printer className="w-4 h-4" />}
            >
              Print
            </Button>
            <Button
              onClick={() => navigate("/purchases/history")}
              variant="outline"
              icon={<Icons.ArrowLeft className="w-4 h-4" />}
            >
              Back to List
            </Button>
            {purchase.status === "DRAFT" && (
              <Button
                onClick={() => navigate(`/purchases/${purchase.id}/edit`)}
                icon={<Icons.Edit className="w-4 h-4" />}
              >
                Edit
              </Button>
            )}
            {purchase.status === "DRAFT" && (
              <Button
                variant="danger"
                onClick={handleDeleteDraft}
                isLoading={isDeleting}
                disabled={isDeleting}
              >
                Delete Draft
              </Button>
            )}
          </div>
        </div>
        {(deleteError || deleteSuccess) && (
          <div className="w-full">
            {deleteError && (
              <Alert variant="error" title="Gagal" description={deleteError} />
            )}
            {deleteSuccess && (
              <Alert
                variant="success"
                title="Berhasil"
                description={deleteSuccess}
              />
            )}
          </div>
        )}
      </div>

      {/* Print Logo */}
      <div className="hidden print:block mb-6">
        <img src="/logo.png" alt="Logo" className="h-12 w-auto" />
        <h1 className="text-2xl font-bold text-gray-900 mt-2">
          PURCHASE ORDER
        </h1>
      </div>

      {/* Header Card */}
      <Card>
        <CardHeader className="bg-gray-50">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Purchase Document</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                {purchase.purchase_no || `ID: ${purchase.id.substring(0, 8)}`}
              </p>
            </div>
            {getStatusBadge(purchase.status)}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Date</p>
              <p className="font-medium">
                {new Date(purchase.purchase_date).toLocaleDateString("id-ID")}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Vendor</p>
              <p className="font-medium">{purchase.vendor_name}</p>
            </div>
            <div>
              <p className="text-gray-600">Terms</p>
              <p className="font-medium">
                <Badge
                  className={
                    purchase.terms === "CASH"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-orange-100 text-orange-800"
                  }
                >
                  {purchase.terms}
                </Badge>
              </p>
            </div>
            <div>
              <p className="text-gray-600">Total</p>
              <p className="font-bold text-lg">
                {formatCurrency(purchase.total_amount)}
              </p>
            </div>
          </div>
          {purchase.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-gray-600 text-sm">Notes</p>
              <p className="text-sm mt-1">{purchase.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>SKU</TableHeader>
                <TableHeader>Item Name</TableHeader>
                <TableHeader>UoM</TableHeader>
                <TableHeader className="text-right">Qty</TableHeader>
                <TableHeader className="text-right">Unit Cost</TableHeader>
                <TableHeader className="text-right">Subtotal</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-sm">
                    {item.sku}
                  </TableCell>
                  <TableCell>{item.item_name}</TableCell>
                  <TableCell>{item.uom_snapshot}</TableCell>
                  <TableCell className="text-right">{item.qty}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.unit_cost)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.subtotal)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-gray-50 font-bold border-t-2">
                <TableCell colSpan={5} className="text-right">
                  TOTAL:
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(purchase.total_amount)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Related Documents (POSTED only) */}
      {purchase.status === "POSTED" && (
        <Card>
          <CardHeader>
            <CardTitle>Related Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {relatedDocs.journal_id && (
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                  <div className="flex items-start gap-3">
                    <div className="text-blue-500 mt-1">
                      <Icons.FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium">Journal Entry</p>
                      <p className="text-gray-600">
                        ID: {relatedDocs.journal_id.substring(0, 8)} | Date:{" "}
                        {new Date(relatedDocs.journal_date!).toLocaleDateString(
                          "id-ID",
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {relatedDocs.ap_bill_id && (
                <div className="flex justify-between items-center p-3 bg-orange-50 rounded">
                  <div className="flex items-start gap-3">
                    <div className="text-orange-500 mt-1">
                      <Icons.FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium">AP Bill (CREDIT)</p>
                      <p className="text-gray-600">
                        ID: {relatedDocs.ap_bill_id.substring(0, 8)} | Total:{" "}
                        {formatCurrency(relatedDocs.ap_total!)} | Outstanding:{" "}
                        {formatCurrency(relatedDocs.ap_outstanding!)} | Status:{" "}
                        <Badge className="ml-1">{relatedDocs.ap_status}</Badge>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
