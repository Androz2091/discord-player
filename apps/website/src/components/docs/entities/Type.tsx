import { docsLink } from '@/lib/docs';
import { cleanupTypes } from '@/lib/util';
import { cn } from '@edge-ui/react';
import Link from 'next/link';
import { useMemo } from 'react';

export function Type({ types, prefix }: { types: string[]; prefix?: string }) {
    const resolvedType = useMemo(() => {
        const resolved: JSX.Element[] = [];

        types = cleanupTypes(types);

        for (let i = 0; i < types.length; i++) {
            const type = types[i];
            const mod = docsLink.internal.find((link) => link.target === type);
            if (!mod) {
                if (!(type in docsLink.external)) {
                    resolved.push(
                        <span key={`${i}-${type}-unresolved`} className={cn('font-semibold', ['keyof', 'typeof', ';', '{', ':'].includes(type) ? 'mr-2' : type === '|' ? 'mx-1' : '', 'text-sm')}>
                            {type}
                        </span>
                    );
                    continue;
                }

                resolved.push(
                    <Link
                        href={docsLink.external[type as keyof typeof docsLink.external]}
                        key={`${i}-${type}-${mod}`}
                        className="text-teal-600 font-semibold text-sm"
                        rel="noreferrer noopener"
                        target="_blank"
                    >
                        <span>{type}</span>
                    </Link>
                );
            } else {
                resolved.push(
                    <Link
                        href={mod.href}
                        key={`${i}-${type}-${mod}`}
                        className={cn('font-semibold text-sm', mod.type === 'class' ? 'text-yellow-600' : mod.type === 'function' ? 'text-purple-600' : 'text-sky-600')}
                    >
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
            {resolvedType}
        </div>
    );
}
