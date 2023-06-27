import { docsLink } from '@/lib/docs';
import { cleanupTypes } from '@/lib/util';
import { cn } from '@edge-ui/react';
import Link from 'next/link';
import { useCallback } from 'react';

export function Type({ types, prefix }: { types: string[]; prefix?: string }) {
    const findType = useCallback(() => {
        const resolved: JSX.Element[] = [];

        types = cleanupTypes(types);

        for (const type of types) {
            const mod = docsLink.internal.find((link) => link.target === type);
            if (!mod) {
                if (!(type in docsLink.external)) {
                    resolved.push(<span className={cn('font-semibold', ['keyof', 'typeof', ';', '{', ':'].includes(type) ? 'mr-2' : type === '|' ? 'mx-1' : '', 'text-sm')}>{type}</span>);
                    continue;
                }

                resolved.push(
                    <Link href={docsLink.external[type as keyof typeof docsLink.external]} className="text-teal-600 font-semibold text-sm" rel="noreferrer noopener" target="_blank">
                        <span>{type}</span>
                    </Link>
                );
            } else {
                resolved.push(
                    <Link href={mod.href} className={cn('font-semibold text-sm', mod.type === 'class' ? 'text-yellow-600' : mod.type === 'function' ? 'text-purple-600' : 'text-sky-600')}>
                        <span>{mod.target}</span>
                    </Link>
                );
            }
        }

        return resolved;
    }, [types]);

    return (
        <div className="flex flex-row items-center">
            {prefix ? <span className="mr-2">{prefix}</span> : null}
            {findType()}
        </div>
    );
}
