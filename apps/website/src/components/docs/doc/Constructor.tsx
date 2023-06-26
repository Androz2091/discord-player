import { getExampleText } from '@/lib/util';
import { CodeBlock, Heading, Paragraph } from '@edge-ui/react';
import type { DocumentedClassConstructor } from 'typedoc-nextra';
import { Example } from './Example';
import { ParameterTable } from './ParameterTable';
export function Constructor({ item }: { item: DocumentedClassConstructor }) {
    if (!item) return <></>;
    return (
        <div>
            <Paragraph>{item.description}</Paragraph>
            <CodeBlock copy={false} language="typescript">{`${item.constructor}(${item.parameters
                .map((p) => {
                    if (p.optional) return `[${p.name}]`;
                    return p.name;
                })
                .join(', ')})`}</CodeBlock>
            {item.parameters.length ? (
                <div>
                    <ParameterTable parameters={item.parameters} />
                </div>
            ) : null}
            <Example item={item} />
        </div>
    );
}
