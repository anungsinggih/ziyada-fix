import { SimpleMasterCRUD } from './SimpleMasterCRUD'

export default function MasterData() {
    return (
        <div className="w-full space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Attributes</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SimpleMasterCRUD table="sizes" title="Sizes" hasCode hasSort />
                <SimpleMasterCRUD table="colors" title="Colors" hasCode hasSort />
                <SimpleMasterCRUD table="uoms" title="UoMs" hasCode />
            </div>
        </div>
    )
}
