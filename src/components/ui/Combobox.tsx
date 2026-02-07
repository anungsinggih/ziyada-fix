import * as React from "react"
import { Icons } from "./Icons"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Command } from "cmdk"
import { cn } from "../../lib/utils.ts"

export type ComboboxOption = {
    value: string
    label: string
    content?: React.ReactNode
    disabled?: boolean
    keywords?: string[] // Additional keywords to search
}

interface ComboboxProps {
    options: ComboboxOption[]
    value?: string
    onChange: (value: string) => void
    placeholder?: string
    searchPlaceholder?: string
    emptyMsg?: string
    className?: string
    modal?: boolean
    disabled?: boolean
    label?: string
    containerClassName?: string
}

export const Combobox = React.forwardRef<HTMLButtonElement, ComboboxProps>(({
    options,
    value,
    onChange,
    placeholder = "Select item...",
    searchPlaceholder = "Search...",
    emptyMsg = "No item found.",
    className,
    containerClassName,
    modal = false,
    disabled = false,
    label
}: ComboboxProps, ref) => {
    const [open, setOpen] = React.useState(false)
    const [search, setSearch] = React.useState("")

    // Find selected label
    const selectedOption = options.find((option) => option.value === value)

    const ComboboxComponent = (
        <PopoverPrimitive.Root open={open} onOpenChange={setOpen} modal={modal}>
            <PopoverPrimitive.Trigger asChild>
                <button
                    ref={ref}
                    disabled={disabled}
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "flex h-10 w-full items-center justify-between rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text-main)] shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                        className
                    )}
                >
                    <span className="truncate">
                        {value
                            ? (selectedOption?.label || value)
                            : <span className="text-gray-400">{placeholder}</span>}
                    </span>
                    <Icons.ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    className="w-[var(--radix-popover-trigger-width)] p-0 z-50 bg-white rounded-md border border-gray-200 shadow-xl overflow-hidden"
                    align="start"
                >
                    <Command className="h-full w-full overflow-hidden bg-popover text-popover-foreground">
                        <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
                            <Command.Input
                                placeholder={searchPlaceholder}
                                value={search}
                                onValueChange={setSearch}
                                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                        <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1">
                            <Command.Empty className="py-6 text-center text-sm text-gray-500">
                                {emptyMsg}
                            </Command.Empty>
                            {options.map((option) => (
                                <Command.Item
                                    key={option.value}
                                    value={option.label + " " + (option.keywords?.join(" ") || "") + " " + option.value} // Trick to search against multiple fields
                                    onSelect={() => {
                                        onChange(option.value === value ? "" : option.value)
                                        setOpen(false)
                                        setSearch("")
                                    }}
                                    disabled={option.disabled}
                                    className={cn(
                                        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-gray-100 data-[selected=true]:text-gray-900 data-[disabled=true]:opacity-50",
                                    )}
                                >
                                    <Icons.Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex-1 w-full overflow-hidden">
                                        {option.content || option.label}
                                    </div>
                                </Command.Item>
                            ))}
                        </Command.List>
                    </Command>
                </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    )

    if (label) {
        return (
            <div className={cn("flex flex-col gap-1.5 mb-3 w-full", containerClassName)}>
                <label className="text-sm font-medium text-[var(--text-main)] shadow-sm">{label}</label>
                {ComboboxComponent}
            </div>
        )
    }

    if (containerClassName) {
        return (
            <div className={containerClassName}>
                {ComboboxComponent}
            </div>
        )
    }

    return ComboboxComponent
})
Combobox.displayName = "Combobox"

