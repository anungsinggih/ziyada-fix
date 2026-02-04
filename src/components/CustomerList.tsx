import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table'
import { Badge } from './ui/Badge'
import { Icons } from './ui/Icons'
import { type Customer } from './CustomerForm'

interface CustomerListProps {
    customers: Customer[]
    loading: boolean
    onEdit: (customer: Customer) => void
    onDelete: (id: string) => void
    onPrices: (customer: Customer) => void
}

export default function CustomerList({ customers, loading, onEdit, onDelete, onPrices }: CustomerListProps) {
    const [searchTerm, setSearchTerm] = useState('')

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone && c.phone.includes(searchTerm)) ||
        (c.address && c.address.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    return (
        <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Customer Directory ({filteredCustomers.length})</CardTitle>
                <div className="w-full sm:w-1/3 sm:min-w-[200px]">
                    <Input
                        placeholder="Search customers..."
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
                                <TableHead>Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow> : filteredCustomers.map(c => (
                                <TableRow key={c.id} className={!c.is_active ? 'bg-gray-100 opacity-60' : ''}>
                                    <TableCell className="font-medium">{c.name}</TableCell>
                                    <TableCell>{c.phone}</TableCell>
                                    <TableCell className="max-w-xs truncate">{c.address}</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={c.customer_type === 'CUSTOM' ? 'warning' : c.customer_type === 'KHUSUS' ? 'secondary' : 'outline'}
                                        >
                                            {c.customer_type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={c.is_active ? 'success' : 'secondary'}>
                                            {c.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="space-x-2 flex">
                                        {c.customer_type === 'CUSTOM' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => onPrices(c)}
                                                icon={<Icons.Tag className="w-4 h-4" />}
                                            />
                                        )}
                                        <Button size="sm" variant="outline" onClick={() => onEdit(c)} icon={<Icons.Edit className="w-4 h-4" />} />
                                        <Button size="sm" variant="danger" onClick={() => onDelete(c.id)} icon={<Icons.Trash className="w-4 h-4" />} />
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
