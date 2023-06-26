import { Badge, Paragraph } from '@edge-ui/react';
import { DocumentedClassMethod, DocumentedFunction } from 'typedoc-nextra';
import { EntitySymbol } from './EntitySymbol';
import { Example } from './Example';
import { ParameterTable } from './ParameterTable';

export function Function({ entity }: { entity: DocumentedFunction | DocumentedClassMethod }) {
    return (
        <div className="space-y-3">
            <EntitySymbol type={'function'} id={`fm-${entity.name}`} link>
                {entity.static ? <span className="text-base text-purple-600">static </span> : ''}
                {entity.name}
                {'('}
                {entity.parameters
                    .map((p) => {
                        if (p.optional) return `[${p.name}]`;
                        return p.name;
                    })
                    .join(', ')}
                {');'}{' '}
            </EntitySymbol>
            <div>
                <Paragraph>{entity.description}</Paragraph>
                <ParameterTable parameters={entity.parameters} />
                <div className="my-2">
                    Returns: <Badge variant="outline">{entity.returns?.type}</Badge>
                    {entity.returns?.description ? <Paragraph>{entity.returns.description}</Paragraph> : null}
                </div>
                <Example item={entity} />
            </div>
        </div>
    );
}
