import { useState } from "react";
import { Alert } from "./ui/Alert";
import { PurchaseEntryForm } from "./PurchaseEntryForm";

export default function Purchases() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  function handleSuccess(msg: string) {
    setSuccess(msg);
    setError(null);
  }

  function handleError(msg: string) {
    setError(msg);
    setSuccess(null);
  }

  return (
    <div className="relative">
      <div className="w-full space-y-6 pb-28">
        <div className="flex items-baseline justify-between">
          <h2 className="hidden md:block text-3xl font-bold tracking-tight text-gray-900">
            Purchases Management
          </h2>
          <span className="hidden md:block text-sm text-gray-500">
            Draft = editable, Posted = locked
          </span>
        </div>
        {error && <Alert variant="error" title="Kesalahan" description={error} />}
        {success && (
          <Alert variant="success" title="Berhasil" description={success} />
        )}

        <div className="space-y-6">
          <PurchaseEntryForm onSuccess={handleSuccess} onError={handleError} />
        </div>
      </div>
    </div>
  );
}
