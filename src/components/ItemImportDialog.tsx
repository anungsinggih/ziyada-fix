import { useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Button } from './ui/Button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog'
import { Icons } from './ui/Icons'
import * as XLSX from 'xlsx'

type ImportDialogProps = {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

type PreviewRow = Record<string, unknown>;

export function ItemImportDialog({ isOpen, onClose, onSuccess }: ImportDialogProps) {
    const [loading, setLoading] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<PreviewRow[]>([])
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            parseFile(selectedFile)
        }
    }

    const parseFile = (file: File) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer)
                const workbook = XLSX.read(data, { type: 'array' })
                const sheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[sheetName]
                const jsonData = XLSX.utils.sheet_to_json(worksheet) as PreviewRow[]
                setPreview(jsonData)
                setError(null)
            } catch (err) {
                setError('Failed to parse file. Please ensure it is a valid Excel or CSV file.')
                console.error(err)
            }
        }
        reader.readAsArrayBuffer(file)
    }

    const handleImport = async () => {
        if (!preview.length) return

        setLoading(true)
        setError(null)

        try {
            const { data, error } = await supabase.rpc('import_master_data', { data: preview })

            if (error) throw error

            alert(`Import successful! Processed: ${data.processed}, Inserted/Updated: ${data.inserted_or_updated}`)
            onSuccess()
            onClose()
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'An unexpected error occurred during import.';
            setError(message)
        } finally {
            setLoading(false)
        }
    }

    const downloadTemplate = () => {
        const headers = [
            'sku', 'name', 'parent_name', 'brand_name', 'category_name',
            'uom_name', 'size_name', 'color_name', 'type',
            'price_umum', 'price_khusus', 'purchase_price', 'min_stock'
        ]
        const ws = XLSX.utils.aoa_to_sheet([headers])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Template")
        XLSX.writeFile(wb, "import_items_template.xlsx")
    }

    return (
        <Dialog isOpen={isOpen} onClose={onClose}>
            <DialogHeader>
                <DialogTitle>Import Items</DialogTitle>
            </DialogHeader>
            <DialogContent>
                <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-md border border-blue-100 text-sm text-blue-800">
                        <p className="mb-2 font-semibold">Instructions:</p>
                        <ul className="list-disc ml-4 space-y-1">
                            <li>Download the template to see the required format.</li>
                            <li>Fill in the data. New Brands, Categories, etc., will be created automatically.</li>
                            <li>Upload user the file below.</li>
                        </ul>
                        <button onClick={downloadTemplate} className="mt-2 text-blue-600 underline hover:text-blue-800 text-xs font-semibold">
                            Download Template
                        </button>
                    </div>

                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
                        <Icons.Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                            {file ? file.name : "Click to select or drag file here"}
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-700 p-3 rounded text-sm border border-red-200">
                            <Icons.Warning className="w-4 h-4 inline mr-2" />
                            {error}
                        </div>
                    )}

                    {preview.length > 0 && (
                        <div className="border rounded-md overflow-hidden">
                            <div className="bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600 border-b">
                                Preview ({preview.length} rows)
                            </div>
                            <div className="max-h-40 overflow-auto">
                                <table className="w-full text-xs text-left">
                                    <thead>
                                        <tr className="bg-gray-50 border-b">
                                            {Object.keys(preview[0] || {}).slice(0, 5).map(k => (
                                                <th key={k} className="p-2 font-medium text-gray-500">{k}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.slice(0, 5).map((row, i) => (
                                            <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                                                {Object.values(row).slice(0, 5).map((v: unknown, j) => (
                                                    <td key={j} className="p-2 truncate max-w-[100px]">{String(v)}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {preview.length > 5 && (
                                    <div className="p-2 text-center text-xs text-gray-400 bg-gray-50 border-t">
                                        ... and {preview.length - 5} more rows
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                        <Button onClick={handleImport} disabled={!file || loading || preview.length === 0}>
                            {loading ? 'Importing...' : 'Start Import'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
