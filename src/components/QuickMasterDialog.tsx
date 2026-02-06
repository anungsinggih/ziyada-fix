import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Checkbox } from './ui/Checkbox'
import { Icons } from './ui/Icons'
import { getErrorMessage } from '../lib/errors'

interface QuickMasterDialogProps {
    table: string
    title: string
    isOpen: boolean
    onClose: () => void
    onSuccess: (newId: string) => void
    hasCode?: boolean
}

export function QuickMasterDialog({ table, title, isOpen, onClose, onSuccess, hasCode = true }: QuickMasterDialogProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [formData, setFormData] = useState({ name: '', code: '', is_active: true })

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!formData.name) return

        setLoading(true)
        setError(null)

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const payload: Record<string, any> = { name: formData.name, is_active: formData.is_active }
            if (hasCode) payload.code = formData.code?.toUpperCase()

            const { data, error } = await supabase.from(table).insert([payload]).select().single()

            if (error) throw error

            onSuccess(data.id)
            handleClose()
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Unknown error occurred'))
        } finally {
            setLoading(false)
        }
    }

    function handleClose() {
        setFormData({ name: '', code: '', is_active: true })
        setError(null)
        onClose()
    }

    return (
        <Dialog isOpen={isOpen} onClose={handleClose}>
            <DialogHeader>
                <DialogTitle>Quick Add: {title}</DialogTitle>
            </DialogHeader>
            <DialogContent>
                <form id="quick-master-form" onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded text-sm flex items-center gap-2">
                            <Icons.Warning className="w-4 h-4" /> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                        {hasCode && (
                            <div className="col-span-1">
                                <Input
                                    label="Code"
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                                    maxLength={10}
                                    placeholder="Ex: PCS"
                                    autoFocus
                                />
                            </div>
                        )}
                        <div className={hasCode ? "col-span-2" : "col-span-3"}>
                            <Input
                                label="Name"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder={`Ex: ${title} Name`}
                                required
                            />
                        </div>
                    </div>



                    <Checkbox
                        label="Active"
                        checked={formData.is_active}
                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                </form>
            </DialogContent>
            <DialogFooter>
                <Button variant="secondary" onClick={handleClose} disabled={loading}>Cancel</Button>
                <Button type="submit" form="quick-master-form" disabled={loading}>
                    {loading ? 'Saving...' : 'Save'}
                </Button>
            </DialogFooter>
        </Dialog>
    )
}
