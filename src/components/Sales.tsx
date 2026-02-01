import { useState } from "react";
import { Alert } from "./ui/Alert";
import { SalesEntryForm } from "./SalesEntryForm";

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
    <div className="relative">
      <div className="w-full space-y-6 pb-28">
        <div className="flex items-baseline justify-between">
          <h2 className="hidden md:block text-3xl font-bold tracking-tight text-gray-900">
            Sales Management
          </h2>
          <span className="hidden md:block text-sm text-gray-500">
            Draft = editable, Posted = locked
          </span>
        </div>

        {error && <Alert variant="error" title="Oops" description={error} />}
        {success && (
          <Alert variant="success" title="Berhasil" description={success} />
        )}

        <div className="space-y-6">
          <SalesEntryForm onSuccess={handleSuccess} onError={handleError} />
        </div>
      </div>
    </div>
  );
}
