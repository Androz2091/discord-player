import { cn, Heading } from '@edge-ui/react';
import { SquareCode } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { VscSymbolClass, VscSymbolInterface, VscSymbolMethod, VscSymbolProperty } from 'react-icons/vsc';

type EntityProps = React.PropsWithChildren<{
    type: 'class' | 'function' | 'interface' | 'property';
    id?: string;
    link?: boolean;
    source?: string;
}>;

export function EntitySymbol({ type, children, id, link, source }: EntityProps) {
    const router = useRouter();
    let c: React.ReactNode;
    const href = `${router.asPath.split('?')[0]}${Object.entries(router.query)
        .filter((f) => !['package', 'scrollTo'].includes(f[0]))
        .map((m, i) => `${i === 0 ? '?' : ''}${m[0]}=${m[1]}`)
        .join('&')}&scrollTo=${id}`;

    const updateLink = () => {
        router.push(href);
    };

    switch (type) {
        case 'class':
            c = (
                <div className={cn('flex items-end gap-2', link ? 'cursor-pointer' : '')} onClick={updateLink}>
                    <VscSymbolClass className="h-6 w-6 text-orange-600" />
                    <Heading.H4 id={id}>{children}</Heading.H4>
                </div>
            );
            break;
        case 'property':
            c = (
                <div className={cn('flex items-end gap-2', link ? 'cursor-pointer' : '')} onClick={updateLink}>
                    <VscSymbolProperty className="h-6 w-6 text-amber-600" />
                    <Heading.H4 id={id}>{children}</Heading.H4>
                </div>
            );
            break;
        case 'function':
            c = (
                <div className={cn('flex items-end gap-2', link ? 'cursor-pointer' : '')} onClick={updateLink}>
                    <VscSymbolMethod className="h-6 w-6 text-purple-600" />
                    <Heading.H4 id={id}>{children}</Heading.H4>
                </div>
            );
            break;
        case 'interface':
            c = (
                <div className={cn('flex items-end gap-2', link ? 'cursor-pointer' : '')} onClick={updateLink}>
                    <VscSymbolInterface className="h-6 w-6 text-blue-600" />
                    <Heading.H4 id={id}>{children}</Heading.H4>
                </div>
            );
            break;
        default:
            c = (
                <Heading.H4 id={id} className={link ? 'cursor-pointer' : ''} onClick={updateLink}>
                    {children}
                </Heading.H4>
            );
            break;
    }
    if (!link)
        return !source ? (
            c
        ) : (
            <div className="flex items-center justify-between">
                {c}{' '}
                <Link href={source} target="_blank" rel="noreferrer noopener">
                    <SquareCode className="text-teal-600" />
                </Link>
            </div>
        );

    return (
        <>
            {!source ? (
                c
            ) : (
                <div className="flex items-center justify-between">
                    {c}{' '}
                    <Link href={source} target="_blank" rel="noreferrer noopener">
                        <SquareCode className="text-teal-600" />
                    </Link>
                </div>
            )}
        </>
    );
}
