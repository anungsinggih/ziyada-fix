import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Badge } from './ui/Badge'
import { Icons } from './ui/Icons'
import { type Vendor } from './VendorForm'

interface VendorListProps {
    vendors: Vendor[]
    loading: boolean
    onEdit: (vendor: Vendor) => void
    onDelete: (id: string) => void
}

export default function VendorList({ vendors, loading, onEdit, onDelete }: VendorListProps) {
    const [searchTerm, setSearchTerm] = useState('')

    const filteredVendors = vendors.filter(v =>
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.phone && v.phone.includes(searchTerm)) ||
        (v.address && v.address.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    return (
        <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Vendor Directory ({filteredVendors.length})</CardTitle>
                <div className="w-full sm:w-1/3 sm:min-w-[200px]">
                    <Input
                        placeholder="Search vendors..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="h-9 mb-0"
                        containerClassName="mb-0"
                    />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Address</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? <TableRow><TableCell colSpan={5} className="text-center">Loading...</TableCell></TableRow> : filteredVendors.map(v => (
                                <TableRow key={v.id} className={!v.is_active ? 'bg-gray-100 opacity-60' : ''}>
                                    <TableCell className="font-medium">{v.name}</TableCell>
                                    <TableCell>{v.phone}</TableCell>
                                    <TableCell className="max-w-xs truncate">{v.address}</TableCell>
                                    <TableCell>
                                        <Badge variant={v.is_active ? 'success' : 'secondary'}>
                                            {v.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="space-x-2 flex">
                                        <Button size="sm" variant="outline" onClick={() => onEdit(v)} icon={<Icons.Edit className="w-4 h-4" />} />
                                        <Button size="sm" variant="danger" onClick={() => onDelete(v.id)} icon={<Icons.Trash className="w-4 h-4" />} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}
