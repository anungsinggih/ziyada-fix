import { useState } from "react";
import { InventoryList } from "./InventoryList";
import StockCard from "./StockCard";
import StockAdjustment from "./StockAdjustment";
import { Icons } from "./ui/Icons";

export default function Inventory() {
    const [view, setView] = useState<'list' | 'card'>('list');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [adjustItem, setAdjustItem] = useState<{ id: string; name: string } | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    function handleAdjustSuccess() {
        setRefreshTrigger(p => p + 1);
        setAdjustItem(null);
    }

    return (
        <div className="relative w-full space-y-4 md:space-y-6 pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <h2 className="hidden md:block text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
                        Inventory Dashboard
                    </h2>
                    <p className="hidden md:block text-sm text-gray-500">
                        Monitoring & Penyesuaian Stok Real-time
                    </p>
                </div>
            </div>

            {/* Mobile Tabs */}
            <div className="flex lg:hidden bg-white border border-gray-200 rounded-lg p-1">
                <button
                    onClick={() => setView('list')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${view === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Daftar Barang
                </button>
                <button
                    onClick={() => setView('card')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${view === 'card' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Riwayat / Kartu Stok
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Left: Inventory List */}
                <div className={`${view === 'list' ? 'block' : 'hidden lg:block'}`}>
                    <InventoryList
                        selectedId={selectedId}
                        onSelect={(id) => {
                            setSelectedId(id);
                            if (id) setView('card'); // Auto switch to card view on mobile when item selected
                        }}
                        onAdjust={(id, name) => setAdjustItem({ id, name })}
                        refreshTrigger={refreshTrigger}
                    />
                </div>

                {/* Right: History / Global Feed */}
                <div className={`lg:sticky lg:top-6 ${view === 'card' ? 'block' : 'hidden lg:block'}`}>
                    <StockCard itemId={selectedId} />
                </div>
            </div>

            {/* Adjust Modal */}
            {adjustItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-orange-50 px-6 py-4 border-b border-orange-100 flex justify-between items-center">
                            <h3 className="font-bold text-orange-900 flex items-center gap-2">
                                <Icons.Edit className="w-5 h-5" />
                                Adjust Stock: {adjustItem.name}
                            </h3>
                            <button onClick={() => setAdjustItem(null)} className="text-gray-400 hover:text-gray-600">
                                <Icons.Close className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <StockAdjustment
                                initialItemId={adjustItem.id}
                                initialItemName={adjustItem.name}
                                isEmbedded={true}
                                onSuccess={handleAdjustSuccess}
                                onCancel={() => setAdjustItem(null)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
