import { Button, cn } from '@edge-ui/react';
import { Root as Collapsible, CollapsibleTrigger, CollapsibleContent } from '@radix-ui/react-collapsible';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface IProps {
    name: string;
    data: { name: string; type: string; lib: string }[];
    link?: (name: string) => string;
    icon?: React.ReactNode;
}

export function ItemList({ data, name, link, icon }: IProps) {
    const router = useRouter();
    const [open, setOpen] = useState(true);

    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger className="w-full">
                <Button className="w-full font-bold justify-between rounded-bl-none rounded-tr-none" variant="outline">
                    <span className="flex items-center  gap-3">
                        {icon} {name}
                    </span>{' '}
                    {open ? <ChevronUp /> : <ChevronDown />}
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-l pl-5">
                {data.map((item) => {
                    const linker = (
                        <h1
                            className={cn(
                                'text-base font-normal text-muted-foreground cursor-pointer',
                                item.lib === router.query.package && item.name === router.query.target && item.type === router.query.type ? 'font-medium text-secondary' : ''
                            )}
                        >
                            {item.name}
                        </h1>
                    );

                    return (
                        <div key={item.name} className="hover:bg-secondary">
                            {link ? <Link href={link(encodeURIComponent(item.name))}>{linker}</Link> : linker}
                        </div>
                    );
                })}
            </CollapsibleContent>
        </Collapsible>
    );
}
