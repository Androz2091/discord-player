import { createContext, useContext, useState } from 'react';
import type { DocumentedClass, DocumentedFunction, DocumentedTypes, TypeDocNextraMarkdownBuild } from 'typedoc-nextra';
import { docs } from './docs';

type Doc<T> = {
    markdown: TypeDocNextraMarkdownBuild[] | null;
    data: T;
};

type DocType = {
    name: string;
    classes: Doc<DocumentedClass>[];
    functions: Doc<DocumentedFunction>[];
    types: Doc<DocumentedTypes>[];
} | null;

interface DocsCtx {
    value: DocType;
    set: React.Dispatch<React.SetStateAction<DocType>>;
}

export const DocsContext = createContext<DocsCtx>({
    value: null,
    set: () => undefined
});

export function useDocs() {
    const { set, value } = useContext(DocsContext);

    return [value, set] as const;
}

export function DocsContextProvider(props: React.PropsWithChildren) {
    const [docVal, setDocVal] = useState<DocType>(() => {
        return Object.values(docs.modules).reduce(
            (p, c) => {
                p.classes.push(...c.classes);
                p.functions.push(...c.functions);
                p.types.push(...c.types);
                return p;
            },
            { classes: [], functions: [], types: [], name: 'discord-player' }
        );
    });

    return (
        <DocsContext.Provider
            value={{
                value: docVal,
                set: setDocVal
            }}
        >
            {props.children}
        </DocsContext.Provider>
    );
}
