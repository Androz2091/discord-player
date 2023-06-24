import { Button, cn, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, useTheme } from '@edge-ui/react';
import { Laptop, Moon, Search, SunMedium } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export function SearchBox() {
    const [open, setOpen] = useState(false);
    const theme = useTheme();

    const runCommand = useCallback((cmd: () => void) => {
        setOpen(false);
        cmd();
    }, []);

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    return (
        <>
            <Button variant="outline" className={cn('relative w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64 hidden lg:inline-flex')} onClick={() => setOpen(true)}>
                <span className="hidden lg:inline-flex">Search documentation...</span>
                <kbd className="pointer-events-none absolute right-1.5 top-2.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </Button>
            <Search className="lg:hidden" onClick={() => setOpen(true)} />
            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Search documentation or command..." />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup heading="Theme">
                        <CommandItem onSelect={() => runCommand(() => theme.setTheme('light'))}>
                            <SunMedium className="mr-2 h-4 w-4" />
                            Light
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => theme.setTheme('dark'))}>
                            <Moon className="mr-2 h-4 w-4" />
                            Dark
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => theme.setTheme('system'))}>
                            <Laptop className="mr-2 h-4 w-4" />
                            System
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    );
}
