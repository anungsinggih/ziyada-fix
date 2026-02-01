import { useState } from 'react'
import { SalesReturnForm } from './SalesReturnForm';
import { SalesReturnDraftList } from './SalesReturnDraftList';

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
        <div className="w-full space-y-8">
            <h2 className="hidden md:block text-3xl font-bold tracking-tight text-gray-900">Sales Return Processing</h2>

            {error && <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md">Error: {error}</div>}
            {success && <div className="p-4 bg-green-50 text-green-700 border border-green-200 rounded-md">Success: {success}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <SalesReturnForm onSuccess={handleSuccess} onError={handleError} />
                </div>

                <div className="lg:col-span-1">
                    <SalesReturnDraftList refreshTrigger={refreshTrigger} onSuccess={handleSuccess} onError={handleError} />
                </div>
            </div>
        </div>
    )
}
