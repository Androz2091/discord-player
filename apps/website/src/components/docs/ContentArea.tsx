import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import type { Documentation, DocumentedClass, DocumentedFunction, DocumentedTypes } from 'typedoc-nextra';
import { Function } from './entities/Function';
import { ClassRenderer } from './renderer/ClassRenderer';
import { TypeRenderer } from './renderer/TypeRenderer';

interface IProps {
    data: Documentation['modules'][string];
}

export function ContentArea({ data }: IProps) {
    const router = useRouter();
    const { package: packageName, type, target, scrollTo } = router.query;
    const [currentItem, setCurrentItem] = useState<DocumentedClass | DocumentedTypes | DocumentedFunction | null>(() => {
        const t = type === 'class' ? 'classes' : type === 'function' ? 'functions' : 'types';
        const res = data[t as Exclude<keyof typeof data, 'name'>] as unknown as { data: DocumentedClass | DocumentedTypes | DocumentedFunction }[];
        const entity = res.find((e) => e.data.name === target)?.data || null;

        return entity;
    });

    useEffect(() => {
        const elm = document.getElementById(scrollTo as string);
        if (!elm) return;
        elm.scrollIntoView({ behavior: 'smooth' });
    }, [scrollTo]);

    useEffect(() => {
        if (!packageName) return;
        if (!target || !type) {
            if (data.classes.length || data.functions.length || data.types.length) {
                const t = data.classes.length ? 'classes' : data.functions.length ? 'functions' : 'types';
                const resolvedType = t === 'classes' ? 'class' : t === 'functions' ? 'function' : 'type';
                if (!type) {
                    const dest = `/docs/${encodeURIComponent(packageName as string)}?type=${resolvedType}&target=${data[t as Exclude<keyof typeof data, 'name'>][0].data.name}${
                        router.query.scrollTo ? `&scrollTo=${router.query.scrollTo}` : ''
                    }`;
                    return void router.replace(dest);
                }
            }
        } else {
            const t = type === 'class' ? 'classes' : type === 'function' ? 'functions' : 'types';
            const res = data[t as Exclude<keyof typeof data, 'name'>] as unknown as { data: DocumentedClass | DocumentedTypes | DocumentedFunction }[];
            const entity = res.find((e) => e.data.name === target)?.data || null;
            setCurrentItem(entity);
        }
    }, [target, type, packageName, data]);

    // @ts-expect-error
    if (!currentItem || currentItem.__type !== type) return <></>;

    return (
        <>
            <Head>
                <title>{currentItem.name} | Discord Player</title>
            </Head>
            <div className="mb-16">
                {type === 'type' ? (
                    <TypeRenderer entity={currentItem as DocumentedTypes} />
                ) : type === 'class' ? (
                    <ClassRenderer entity={currentItem as DocumentedClass} />
                ) : type === 'function' ? (
                    <Function entity={currentItem as DocumentedFunction} />
                ) : null}
            </div>
        </>
    );
}
