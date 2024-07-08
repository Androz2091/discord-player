'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
    cn,
    Button,
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@edge-ui/react';

interface IProps {
    onSelect: (value: string) => void;
    value: string;
    options: { label: string; value: string }[];
    selectMessage?: string;
    emptyMessage?: string;
    searchMessage?: string;
}

// prettier-ignore
export function Combobox({
    onSelect,
    options,
    value,
    emptyMessage = 'No result found.',
    selectMessage = 'Select an item...',
    searchMessage = 'Search an item...'
}: IProps) {
    const [open, setOpen] = React.useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
                    {value ? options.find((item) => item.value === value)?.label : selectMessage}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
                <Command>
                    <CommandInput placeholder={searchMessage} />
                    <CommandEmpty>{emptyMessage}</CommandEmpty>
                    <CommandGroup>
                        {options.map((item) => (
                            <CommandItem
                                key={item.value}
                                onSelect={(currentValue) => {
                                    onSelect(currentValue === value ? '' : currentValue);
                                    setOpen(false);
                                }}
                            >
                                <Check className={cn('mr-2 h-4 w-4', value === item.value ? 'opacity-100' : 'opacity-0')} />
                                {item.label}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
