import { SimpleMasterCRUD } from './SimpleMasterCRUD'

export default function BrandsCategories() {
    return (
        <div className="w-full space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="hidden md:block text-2xl font-bold tracking-tight">Brands & Categories</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SimpleMasterCRUD table="brands" title="Brands" />
                <SimpleMasterCRUD table="categories" title="Categories" />
            </div>
        </div>
    )
}
