import * as SelectPrimitive from '@radix-ui/react-select'
import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons'
import React, { useState, useMemo, useRef, useEffect } from 'react'

type SelectOption = {
    label: string
    value: string | number
    disabled?: boolean
    searchText?: string // Optional custom search text
    content?: React.ReactNode // Optional custom React content
}

interface SelectProps {
    label?: string
    options: SelectOption[]
    value?: string | number
    defaultValue?: string | number
    placeholder?: string
    disabled?: boolean
    className?: string
    triggerClassName?: string
    contentClassName?: string
    searchPlaceholder?: string
    onValueChange?: (value: string) => void
    onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void
}

const EMPTY_VALUE_SENTINEL = '__RADIX_SELECT_EMPTY__'
const SelectContent = SelectPrimitive.Content as React.ComponentType<unknown>

const toInternalValue = (val?: string | number) => {
    if (val === undefined || val === null) return undefined
    if (val === '') return EMPTY_VALUE_SENTINEL
    return val.toString()
}

const fromInternalValue = (val?: string) => {
    if (!val) return ''
    return val === EMPTY_VALUE_SENTINEL ? '' : val
}

export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(({
    label,
    options,
    placeholder,
    className = '',
    triggerClassName = '',
    contentClassName = '',
    value,
    defaultValue,
    onValueChange,
    onChange,
    disabled,
    searchPlaceholder = 'Search...',
}, ref) => {
    const [searchTerm, setSearchTerm] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const isSearchFocusedRef = useRef(false)
    // Determine whether to use native select on mount
    const [useNativeSelect] = useState(() => {
        if (typeof window === 'undefined') return false
        const isCoarse = window.matchMedia?.('(pointer: coarse)')?.matches
        const isSmall = window.matchMedia?.('(max-width: 640px)')?.matches
        const ua = navigator.userAgent || ''
        const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
        return Boolean(isCoarse || isSmall || isMobileUA)
    })
    const [mobileOpen, setMobileOpen] = useState(false)
    const normalizedOptions = useMemo(
        () => options.map(opt => ({
            ...opt,
            internalValue: toInternalValue(opt.value) ?? opt.value.toString(),
        })),
        [options]
    )

    // Reset search when mobile dialog closes - using ref to avoid setState in effect warning
    useEffect(() => {
        if (!useNativeSelect) return
        if (mobileOpen) return // Only reset when closing
        const timer = setTimeout(() => setSearchTerm(''), 0)
        return () => clearTimeout(timer)
    }, [mobileOpen, useNativeSelect])

    useEffect(() => {
        if (!useNativeSelect || !mobileOpen) return
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = previous
        }
    }, [mobileOpen, useNativeSelect])

    const handleChange = (selected: string) => {
        const matched = normalizedOptions.find(o => o.internalValue === selected)
        const finalValue = matched ? matched.value.toString() : fromInternalValue(selected)
        onValueChange?.(finalValue)
        if (onChange) {
            const event = {
                target: { value: finalValue },
            } as React.ChangeEvent<HTMLSelectElement>
            onChange(event)
        }
        setSearchTerm('') // Clear search on selection
    }

    // Filter options based on search term
    const filteredOptions = useMemo(() => {
        if (!searchTerm.trim()) return options

        const term = searchTerm.toLowerCase()
        return options.filter(opt => {
            const searchIn = opt.searchText || opt.label
            return searchIn.toLowerCase().includes(term)
        })
    }, [options, searchTerm])

    if (useNativeSelect) {
        const currentValue = value ?? ''
        const currentLabel = options.find(opt => opt.value.toString() === currentValue.toString())?.label || ''
        const mobileOptions = searchTerm.trim()
            ? options.filter(opt => {
                const searchIn = opt.searchText || opt.label
                return searchIn.toLowerCase().includes(searchTerm.toLowerCase())
            })
            : options

        return (
            <div className={`flex flex-col gap-1.5 mb-3 w-full ${className}`}>
                {label && <label className="text-sm font-medium text-[var(--text-main)]">{label}</label>}
                <button
                    ref={ref}
                    type="button"
                    className={`flex h-10 w-full items-center justify-between rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-normal text-[var(--text-main)] shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50 ${triggerClassName}`}
                    onClick={() => setMobileOpen(true)}
                    disabled={disabled}
                >
                    <span className={currentLabel ? '' : 'text-gray-400'}>
                        {currentLabel || placeholder || 'Select...'}
                    </span>
                    <ChevronDownIcon className="h-4 w-4 text-[var(--text-main)]" />
                </button>

                {mobileOpen && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                                <div className="text-sm font-semibold text-[var(--text-main)]">
                                    {label || 'Select'}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setMobileOpen(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                    aria-label="Close"
                                >
                                    ×
                                </button>
                            </div>
                            <div className="p-3 border-b border-[var(--border)]">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={searchPlaceholder}
                                    className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-[var(--primary)] transition-all duration-200"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    spellCheck="false"
                                />
                            </div>
                            <div className="overflow-y-auto">
                                {mobileOptions.length === 0 ? (
                                    <div className="py-6 text-center text-sm text-gray-500">
                                        No results found
                                    </div>
                                ) : (
                                    mobileOptions.map(opt => {
                                        const optValue = opt.value.toString()
                                        const isSelected = optValue === currentValue.toString()
                                        return (
                                            <button
                                                key={optValue}
                                                type="button"
                                                disabled={opt.disabled}
                                                onClick={() => {
                                                    onValueChange?.(optValue)
                                                    if (onChange) {
                                                        const event = {
                                                            target: { value: optValue },
                                                        } as React.ChangeEvent<HTMLSelectElement>
                                                        onChange(event)
                                                    }
                                                    setMobileOpen(false)
                                                    setSearchTerm('')
                                                }}
                                                className={`w-full text-left px-4 py-3 text-sm border-b border-gray-100 ${opt.disabled ? 'text-gray-400' : 'text-[var(--text-main)] hover:bg-gray-50'} ${isSelected ? 'bg-[var(--primary)]/10' : ''}`}
                                            >
                                                {opt.content || opt.label}
                                            </button>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className={`flex flex-col gap-1.5 mb-3 w-full ${className}`}>
            {label && <label className="text-sm font-medium text-[var(--text-main)] shadow-sm">{label}</label>}

            <SelectPrimitive.Root
                value={toInternalValue(value)}
                defaultValue={toInternalValue(defaultValue)}
                onValueChange={handleChange}
                disabled={disabled}
                open={isOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        const active = document.activeElement as HTMLElement | null
                        if (isSearchFocusedRef.current || active?.dataset?.selectSearch === 'true') return
                    }
                    setIsOpen(open)
                    if (!open) setSearchTerm('') // Clear search when closed
                }}
            >
                <SelectPrimitive.Trigger
                    ref={ref}
                    className={`flex h-10 w-full items-center justify-between rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-normal text-[var(--text-main)] shadow-sm transition-all duration-200 hover:border-gray-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50 ${triggerClassName}`}
                >
                    <SelectPrimitive.Value placeholder={placeholder || 'Select...'} />
                    <SelectPrimitive.Icon className="text-[var(--text-main)]">
                        <ChevronDownIcon className="h-4 w-4" />
                    </SelectPrimitive.Icon>
                </SelectPrimitive.Trigger>

                <SelectPrimitive.Portal>

                    {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                    {/* @ts-ignore: Radix UI SelectContent doesn't expose onInteractOutside in types but accepts it */}
                    <SelectContent
                        className={`relative z-[200] max-w-[95vw] overflow-hidden rounded-xl border border-gray-100 bg-white/95 backdrop-blur-md shadow-xl animate-in fade-in-0 zoom-in-95 duration-200 ${contentClassName}`}
                        position="popper"
                        sideOffset={4}
                        align="start"
                        avoidCollisions={true}
                        onInteractOutside={(e: Event) => {
                            const target = e.target as HTMLElement | null
                            if (target?.closest('[data-select-search="true"]')) {
                                e.preventDefault()
                            }
                        }}
                        onPointerDownOutside={(e: Event) => {
                            const target = e.target as HTMLElement | null
                            if (target?.closest('[data-select-search="true"]')) {
                                e.preventDefault()
                            }
                        }}
                        onFocusOutside={(e: Event) => {
                            const target = e.target as HTMLElement | null
                            if (isSearchFocusedRef.current || target?.closest('[data-select-search="true"]')) {
                                e.preventDefault()
                            }
                        }}
                    >
                        {/* Search Input */}
                        <div className="sticky top-0 z-10 bg-white border-b border-[var(--border)] p-2">
                            <div className="relative">
                                <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value)
                                        if (!isOpen) setIsOpen(true)
                                    }}
                                    placeholder={searchPlaceholder}
                                    className="w-full h-8 pl-8 pr-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                                    onKeyDown={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onPointerUp={(e) => e.stopPropagation()}
                                    onTouchStart={(e) => e.stopPropagation()}
                                    onTouchEnd={(e) => e.stopPropagation()}
                                    onClick={(e) => e.stopPropagation()}
                                    onFocus={(e) => {
                                        isSearchFocusedRef.current = true
                                        e.stopPropagation()
                                    }}
                                    onBlur={() => {
                                        isSearchFocusedRef.current = false
                                    }}
                                    data-select-search="true"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    spellCheck="false"
                                />
                            </div>
                        </div>

                        <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center bg-white text-[var(--text-main)]">
                            <ChevronDownIcon className="h-4 w-4 rotate-180" />
                        </SelectPrimitive.ScrollUpButton>

                        <SelectPrimitive.Viewport className="max-h-[300px] overflow-auto p-1">
                            {filteredOptions.length === 0 ? (
                                <div className="py-6 text-center text-sm text-gray-500">
                                    No results found
                                </div>
                            ) : (
                                filteredOptions.map(opt => {
                                    const normalized = normalizedOptions.find(no => no.value === opt.value)
                                    const internalValue = normalized?.internalValue ?? opt.value.toString()
                                    return (
                                        <SelectPrimitive.Item
                                            key={internalValue}
                                            value={internalValue}
                                            disabled={opt.disabled}
                                            className="relative flex cursor-pointer select-none items-center justify-between rounded-md px-3 py-2 text-sm text-[var(--text-main)] outline-none data-[highlighted]:bg-[var(--primary)]/10 data-[highlighted]:text-[var(--primary)] focus:bg-[var(--primary)]/10 focus:text-[var(--primary)] disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent"
                                        >
                                            <SelectPrimitive.ItemText>{opt.content || opt.label}</SelectPrimitive.ItemText>
                                            <SelectPrimitive.ItemIndicator className="text-[var(--primary)]">
                                                <CheckIcon className="h-4 w-4" />
                                            </SelectPrimitive.ItemIndicator>
                                        </SelectPrimitive.Item>
                                    )
                                })
                            )}
                        </SelectPrimitive.Viewport>

                        <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center bg-white text-[var(--text-main)]">
                            <ChevronDownIcon className="h-4 w-4" />
                        </SelectPrimitive.ScrollDownButton>
                    </SelectContent>
                </SelectPrimitive.Portal>
            </SelectPrimitive.Root>
        </div>
    )
})
Select.displayName = 'Select'
