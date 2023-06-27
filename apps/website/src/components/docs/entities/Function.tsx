import { inter } from '@/lib/constants';
import { Badge, Paragraph } from '@edge-ui/react';
import { DocumentedClassMethod, DocumentedFunction } from 'typedoc-nextra';
import { EntitySymbol } from './EntitySymbol';
import { Example } from './Example';
import { ParameterTable } from './ParameterTable';
import { Type } from './Type';

export function Function({ entity }: { entity: DocumentedFunction | DocumentedClassMethod }) {
    return (
        <div className="space-y-3">
            <EntitySymbol type={'function'} id={`fm-${entity.name}`} link source={entity.metadata?.url}>
                {entity.static ? <span className="text-base text-purple-600">static </span> : ''}
                {entity.name}
                {'('}
                {entity.parameters
                    .map((p) => {
                        if (p.optional) return `[${p.name}]`;
                        return p.name;
                    })
                    .join(', ')}
                {');'} {entity.deprecated ? <Badge variant="destructive">Deprecated</Badge> : null}
            </EntitySymbol>
            <div>
                <Paragraph>
                    <pre className={inter.className}>{entity.description}</pre>
                </Paragraph>
                <ParameterTable parameters={entity.parameters} />
                <div className="my-2">
                    <Type types={entity.returns?.rawType || ['any']} prefix="Returns:" />
                    {entity.returns?.description ? <Paragraph>{entity.returns.description}</Paragraph> : null}
                </div>
                <Example item={entity} />
            </div>
        </div>
    );
}
