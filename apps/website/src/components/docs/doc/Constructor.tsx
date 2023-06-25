import { CodeBlock, Paragraph } from '@edge-ui/react';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@edge-ui/react';
import type { DocumentedClassConstructor } from 'typedoc-nextra';
import { ParameterTable } from './ParameterTable';

export function Constructor({ item }: { item: DocumentedClassConstructor }) {
    if (!item) return <></>;
    return (
        <div>
            <Paragraph>{item.description}</Paragraph>
            <CodeBlock copy={false} language="typescript">{`new ${item.constructor}(${item.parameters
                .map((p) => {
                    if (p.optional) return `${p.name}?`;
                    return p.name;
                })
                .join(', ')})`}</CodeBlock>
            {item.parameters.length ? (
                <div>
                    <ParameterTable parameters={item.parameters} />
                </div>
            ) : null}
        </div>
    );
}
