import { useState } from 'react'
import { SalesReturnForm } from './SalesReturnForm';
import { PageHeader } from './ui/PageHeader';

export default function SalesReturn() {
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    function handleSuccess(msg: string) {
        setSuccess(msg);
        setError(null);
    }

    function handleError(msg: string) {
        setError(msg);
        setSuccess(null);
    }

    return (
        <div className="w-full space-y-6 pb-20">
            <PageHeader
                title="Sales Return Processing"
                description="Process customer returns, create drafts, and manage stock adjustments."
                breadcrumbs={[
                    { label: "Dashboard", href: "/" },
                    { label: "Sales", href: "/sales/history" },
                    { label: "New Return" }
                ]}
            />

            {error && <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md shadow-sm">Error: {error}</div>}
            {success && <div className="p-4 bg-green-50 text-green-700 border border-green-200 rounded-md shadow-sm">Success: {success}</div>}

            <div className="max-w-6xl mx-auto">
                <SalesReturnForm onSuccess={handleSuccess} onError={handleError} />
            </div>
        </div>
    )
}
