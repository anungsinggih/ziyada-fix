import { useState } from "react";
import { Alert } from "./ui/Alert";
import { SalesEntryForm } from "./SalesEntryForm";
import { PageHeader } from "./ui/PageHeader";

export default function Sales() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleSuccess(msg: string) {
    setSuccess(msg);
    // Clear error
    setError(null);
  }

  function handleError(msg: string) {
    setError(msg);
    // Clear success
    setSuccess(null);
  }

  return (
    <div className="w-full space-y-6 pb-28">
      <PageHeader
        title="Sales Management"
        description="Process sales, manage drafts, and finalize transactions. (Draft = editable, Posted = locked)"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Sales" }]}
      />

      {error && <Alert variant="error" title="Oops" description={error} />}
      {success && (
        <Alert variant="success" title="Berhasil" description={success} />
      )}

      <div className="space-y-6">
        <SalesEntryForm onSuccess={handleSuccess} onError={handleError} />
      </div>
    </div>
  );
}
