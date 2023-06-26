import { cn, Heading } from '@edge-ui/react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { VscSymbolClass, VscSymbolInterface, VscSymbolMethod, VscSymbolProperty } from 'react-icons/vsc';

export function EntitySymbol({ type, children, id, link }: React.PropsWithChildren<{ type: 'class' | 'function' | 'interface' | 'property'; id?: string; link?: boolean }>) {
    const router = useRouter();
    let c: React.ReactNode;

    switch (type) {
        case 'class':
            c = (
                <div className={cn('flex items-end gap-2', link ? 'cursor-pointer' : '')}>
                    <VscSymbolClass className="h-6 w-6 text-orange-600" />
                    <Heading.H4 id={id}>{children}</Heading.H4>
                </div>
            );
            break;
        case 'property':
            c = (
                <div className={cn('flex items-end gap-2', link ? 'cursor-pointer' : '')}>
                    <VscSymbolProperty className="h-6 w-6 text-amber-600" />
                    <Heading.H4 id={id}>{children}</Heading.H4>
                </div>
            );
            break;
        case 'function':
            c = (
                <div className={cn('flex items-end gap-2', link ? 'cursor-pointer' : '')}>
                    <VscSymbolMethod className="h-6 w-6 text-purple-600" />
                    <Heading.H4 id={id}>{children}</Heading.H4>
                </div>
            );
            break;
        case 'interface':
            c = (
                <div className={cn('flex items-end gap-2', link ? 'cursor-pointer' : '')}>
                    <VscSymbolInterface className="h-6 w-6 text-blue-600" />
                    <Heading.H4 id={id}>{children}</Heading.H4>
                </div>
            );
            break;
        default:
            c = (
                <Heading.H4 id={id} className={link ? 'cursor-pointer' : ''}>
                    {children}
                </Heading.H4>
            );
            break;
    }
    if (!link) return c;

    return (
        <Link
            href={`${router.asPath.split('?')[0]}${Object.entries(router.query)
                .filter((f) => !['package', 'scrollTo'].includes(f[0]))
                .map((m, i) => `${i === 0 ? '?' : ''}${m[0]}=${m[1]}`)
                .join('&')}&scrollTo=${id}`}
        >
            {c}
        </Link>
    );
}
