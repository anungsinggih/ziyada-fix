import { useState } from 'react'
import { SalesReturnForm } from './SalesReturnForm';
import { SalesReturnDraftList } from './SalesReturnDraftList';
import { PageHeader } from './ui/PageHeader';

export default function SalesReturn() {
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    function handleSuccess(msg: string) {
        setSuccess(msg);
        setRefreshTrigger(prev => prev + 1);
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

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
                <div className="xl:col-span-2 space-y-6">
                    <SalesReturnForm onSuccess={handleSuccess} onError={handleError} />
                </div>

                <div className="xl:col-span-1">
                    <div className="xl:sticky xl:top-6 space-y-6">
                        <SalesReturnDraftList refreshTrigger={refreshTrigger} onSuccess={handleSuccess} onError={handleError} />
                    </div>
                </div>
            </div>
        </div>
    )
}
