import { SimpleMasterCRUD } from './SimpleMasterCRUD'

export default function Attributes() {
    return (
        <div className="w-full space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="hidden md:block text-2xl font-bold tracking-tight">Product Attributes</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SimpleMasterCRUD table="sizes" title="Sizes" hasCode />
                <SimpleMasterCRUD table="colors" title="Colors" hasCode />
                <SimpleMasterCRUD table="uoms" title="UoMs" hasCode />
            </div>
        </div>
    )
}
