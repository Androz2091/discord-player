import { searchDocs } from '@/lib/docs';
import { Button, cn, useDebounce } from '@edge-ui/react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/cmdk/CommandDialog';
import { Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { VscSymbolClass, VscSymbolInterface, VscSymbolMethod, VscSymbolProperty } from 'react-icons/vsc';
import { useRouter } from 'next/router';

export function SearchBox() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState('');
    const query = useDebounce(value);
    const [result, setResult] = useState<ReturnType<typeof searchDocs>>([]);

    const runCommand = useCallback((cmd: () => void) => {
        setOpen(false);
        cmd();
    }, []);

    void runCommand;

    const onValueChange = (val: string) => {
        setValue(val);
    };

    useEffect(() => {
        if (!query.length) return setResult([]);
        setResult(searchDocs(query));
    }, [query]);

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
            <CommandDialog
                open={open}
                shouldFilter={false}
                onOpenChange={(opn) => {
                    setOpen(opn);
                    setValue('');
                }}
            >
                <CommandInput placeholder="Search documentation or command..." value={value} onValueChange={onValueChange} />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup heading={`Total ${result.length} results`}>
                        {result.map((res, i) => {
                            return (
                                <CommandItem
                                    key={`${res.name}-${i}`}
                                    onSelect={() => {
                                        runCommand(() => router.push(res.href));
                                    }}
                                >
                                    {res.type === 'class' ? (
                                        <VscSymbolClass className="h-4 w-4 mr-2 text-orange-600" />
                                    ) : res.type === 'function' ? (
                                        <VscSymbolMethod className="h-4 w-4 mr-2 text-purple-600" />
                                    ) : res.type === 'property' ? (
                                        <VscSymbolProperty className="h-4 w-4 mr-2 text-amber-600" />
                                    ) : (
                                        <VscSymbolInterface className="h-4 w-4 mr-2 text-blue-600" />
                                    )}
                                    {res.displayName} (<span className="text-muted-foreground text-sm">{res.module}</span>)
                                </CommandItem>
                            );
                        })}
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    );
}
