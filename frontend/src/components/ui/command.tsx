import * as React from "react"
import { Search } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./dialog"
import { type DialogProps } from "@radix-ui/react-dialog"

export interface CommandProps extends React.HTMLAttributes<HTMLDivElement> { }

const Command = React.forwardRef<HTMLDivElement, CommandProps>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={`flex h-full w-full flex-col overflow-hidden rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${className || ''}`}
            {...props}
        />
    )
)
Command.displayName = "Command"

export interface CommandInputProps extends React.InputHTMLAttributes<HTMLInputElement> { }

const CommandInput = React.forwardRef<HTMLInputElement, CommandInputProps>(
    ({ className, ...props }, ref) => (
        <div className="flex items-center border-b border-gray-200 dark:border-gray-700 px-3" cmdk-input-wrapper="">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
                ref={ref}
                aria-label="Search"
                className={`flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-500 dark:placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50 ${className || ''}`}
                {...props}
            />
        </div>
    )
)
CommandInput.displayName = "CommandInput"

export interface CommandListProps extends React.HTMLAttributes<HTMLDivElement> { }

const CommandList = React.forwardRef<HTMLDivElement, CommandListProps>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={`max-h-[300px] overflow-y-auto overflow-x-hidden ${className || ''}`}
            {...props}
        />
    )
)
CommandList.displayName = "CommandList"

export interface CommandEmptyProps extends React.HTMLAttributes<HTMLDivElement> { }

const CommandEmpty = React.forwardRef<HTMLDivElement, CommandEmptyProps>(
    (props, ref) => (
        <div
            ref={ref}
            className="py-6 text-center text-sm text-gray-500 dark:text-gray-400"
            {...props}
        />
    )
)
CommandEmpty.displayName = "CommandEmpty"

export interface CommandGroupProps extends React.HTMLAttributes<HTMLDivElement> {
    heading?: string
}

const CommandGroup = React.forwardRef<HTMLDivElement, CommandGroupProps>(
    ({ heading, className, ...props }, ref) => (
        <div ref={ref} className={`overflow-hidden p-1 ${className || ''}`} cmdk-group="">
            {heading && (
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400" cmdk-group-heading="">
                    {heading}
                </div>
            )}
            <div cmdk-group-items="">{props.children}</div>
        </div>
    )
)
CommandGroup.displayName = "CommandGroup"

export interface CommandItemProps extends React.HTMLAttributes<HTMLDivElement> {
    onSelect?: () => void
}

const CommandItem = React.forwardRef<HTMLDivElement, CommandItemProps>(
    ({ className, onSelect, ...props }, ref) => (
        <div
            ref={ref}
            className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-100 dark:hover:bg-gray-700 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className || ''}`}
            onClick={onSelect}
            {...props}
        />
    )
)
CommandItem.displayName = "CommandItem"

interface CommandDialogProps extends DialogProps { }

const CommandDialog = ({ children, ...props }: CommandDialogProps) => {
    return (
        <Dialog {...props}>
            <DialogContent className="overflow-hidden p-0 shadow-lg !fixed">
                <DialogTitle className="sr-only">Search Symbols</DialogTitle>
                <DialogDescription className="sr-only">Search for a trading symbol to analyze</DialogDescription>
                <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
                    {children}
                </Command>
            </DialogContent>
        </Dialog>
    )
}

export {
    Command,
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
}
