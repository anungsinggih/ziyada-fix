import { useState, useRef } from 'react'
import { supabase } from '../../supabaseClient'
import imageCompression from 'browser-image-compression'
import { Icons } from './Icons'
import { Button } from './Button'

interface ImageUploadProps {
    value?: string | null
    onChange: (url: string) => void
    folder?: string // e.g. "product-parents"
}

export function ImageUpload({ value, onChange, folder = 'uploads' }: ImageUploadProps) {
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]
        if (!file) return

        setError(null)
        setUploading(true)
        setProgress(10) // Started

        try {
            // 1. Compress Image
            const options = {
                maxSizeMB: 0.5, // Max 500KB
                maxWidthOrHeight: 1000,
                useWebWorker: true,
                fileType: 'image/webp'
            }

            const compressedFile = await imageCompression(file, options)
            setProgress(40) // Compressed

            // 2. Upload to Supabase
            const fileExt = 'webp'
            const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(fileName, compressedFile, {
                    cacheControl: '3600',
                    upsert: false
                })

            if (uploadError) throw uploadError

            setProgress(80) // Uploaded

            // 3. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('images')
                .getPublicUrl(fileName)

            onChange(publicUrl)
            setProgress(100)

        } catch (err: unknown) {
            console.error(err)
            const msg = err instanceof Error ? err.message : 'Upload failed'
            setError(msg)
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = '' // Reset input
        }
    }

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Image
            </label>

            <div className="flex items-start gap-4">
                {/* Preview Box */}
                <div className="relative w-24 h-24 border rounded-md overflow-hidden bg-slate-50 flex items-center justify-center shrink-0">
                    {value ? (
                        <img src={value} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                        <Icons.Image className="w-8 h-8 text-slate-300" />
                    )}
                    {uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">{progress}%</span>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex-1 space-y-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                    />

                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                        >
                            {uploading ? 'Compressing & Uploading...' : 'Choose Image'}
                        </Button>

                        {value && (
                            <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                onClick={() => onChange('')}
                                disabled={uploading}
                            >
                                Remove
                            </Button>
                        )}
                    </div>

                    <p className="text-[10px] text-slate-500">
                        Auto converted to WebP. Max 1000px width.
                    </p>

                    {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
                </div>
            </div>
        </div>
    )
}
