import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/Table";
import { Alert } from "./ui/Alert";
import { StatusBadge } from "./ui/StatusBadge";

type Period = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "OPEN" | "CLOSED";
  updated_at: string;
};

type ExportLog = {
  id: string;
  report_type: string;
  exported_at: string | null;
  notes: string;
};

export default function PeriodLock() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form
  const buildCurrentPeriodDefaults = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const toDate = (d: Date) => d.toISOString().split("T")[0];
    const name = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    return {
      name,
      start_date: toDate(start),
      end_date: toDate(end),
    };
  };

  const [formData, setFormData] = useState(buildCurrentPeriodDefaults);

  // Exports
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [logs, setLogs] = useState<ExportLog[]>([]);

  // -- 1. PERIODS OPS --
  // Wrap in useCallback to allow usage in useEffect dependency
  const fetchPeriods = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("accounting_periods")
      .select("*")
      .order("start_date", { ascending: false });

    if (error) setError(error.message);
    else setPeriods(data || []);
    setLoading(false);
  }, []);

  async function handleCreate() {
    if (!formData.name || !formData.start_date || !formData.end_date) {
      setError("All fields required");
      return;
    }
    setError(null);
    setSuccess(null);

    const { error } = await supabase.rpc("rpc_create_period", {
      p_name: formData.name,
      p_start_date: formData.start_date,
      p_end_date: formData.end_date,
    });

    if (error) setError(error.message);
    else {
      setSuccess("Period Created");
      setFormData(buildCurrentPeriodDefaults());
      fetchPeriods();
    }
  }

  async function toggleStatus(p: Period) {
    if (
      !confirm(`Switch status to ${p.status === "OPEN" ? "CLOSED" : "OPEN"}?`)
    )
      return;

    const newStatus = p.status === "OPEN" ? "CLOSED" : "OPEN";
    const { error } = await supabase.rpc("rpc_set_period_status", {
      p_period_id: p.id,
      p_status: newStatus,
    });
    if (error) setError(error.message);
    else fetchPeriods();
  }

  // -- 2. EXPORTS OPS --
  const fetchLogs = useCallback(async (periodId: string) => {
    setSelectedPeriodId(periodId);
    const { data, error } = await supabase
      .from("period_exports")
      .select("*")
      .eq("period_id", periodId)
      .order("exported_at", { ascending: false });

    if (error) setError(error.message);
    else setLogs(data || []);
  }, []);

  async function handleExport(type: string) {
    if (!selectedPeriodId) return;
    // Mock Export: Insert Log
    const { error } = await supabase.rpc("rpc_export_period_reports", {
      p_period_id: selectedPeriodId,
      p_report_type: type,
      p_notes: "Manual Export via UI",
    });

    if (error) setError(error.message);
    else {
      alert(`Export ${type} generated (Simulated Download)`);
      fetchLogs(selectedPeriodId);
    }
  }

  // Use effects at the end of definitions
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPeriods();
  }, [fetchPeriods]);

  return (
    <div className="w-full space-y-8">
      <h2 className="hidden md:block text-3xl font-bold tracking-tight text-gray-900">
        Period Management
      </h2>

      {error && <Alert variant="error" title="Kesalahan" description={error} />}
      {success && (
        <Alert variant="success" title="Berhasil" description={success} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
        <Card className="md:col-span-1 shadow-md h-fit">
          <CardHeader className="bg-gray-50 border-b border-gray-100">
            <CardTitle>Create Accounting Period</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <Input
              label="Name (e.g. 2024-01)"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="YYYY-MM"
            />
            <Input
              label="Start Date"
              type="date"
              value={formData.start_date}
              onChange={(e) =>
                setFormData({ ...formData, start_date: e.target.value })
              }
            />
            <Input
              label="End Date"
              type="date"
              value={formData.end_date}
              onChange={(e) =>
                setFormData({ ...formData, end_date: e.target.value })
              }
            />
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={handleCreate}
              disabled={loading}
            >
              Create Period
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-md">
          <CardHeader className="bg-gray-50 border-b border-gray-100">
            <CardTitle>Existing Periods</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map((p) => (
                    <TableRow
                      key={p.id}
                      className={
                        p.status === "CLOSED" ? "bg-gray-50 opacity-75" : ""
                      }
                    >
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.start_date}</TableCell>
                      <TableCell>{p.end_date}</TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                      <TableCell className="flex gap-2">
                        <Button
                          size="sm"
                          variant={p.status === "OPEN" ? "danger" : "outline"}
                          onClick={() => toggleStatus(p)}
                        >
                          {p.status === "OPEN" ? "Lock" : "Re-open"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => fetchLogs(p.id)}
                        >
                          Exports
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedPeriodId && (
        <Card className="shadow-md border-blue-200">
          <CardHeader className="bg-blue-50 border-b border-blue-100">
            <CardTitle className="text-blue-900">
              Export Management for Selected Period
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 mb-6">
              <Button
                onClick={() => handleExport("GL")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Export GL
              </Button>
              <Button
                onClick={() => handleExport("TB")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Export Trial Balance
              </Button>
              <Button
                onClick={() => handleExport("PL")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Export P&L
              </Button>
            </div>

            <h4 className="font-semibold text-gray-700 mb-2">Export Logs</h4>
            <div className="rounded-md border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Report</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-gray-400 italic"
                        >
                          No exports recorded
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {log.exported_at
                              ? new Date(log.exported_at).toLocaleString()
                              : "Timestamp unavailable"}
                          </TableCell>
                          <TableCell className="font-mono">
                            {log.report_type}
                          </TableCell>
                          <TableCell>{log.notes}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
