import { Badge, Paragraph } from '@edge-ui/react';
import type { DocumentedClassProperty } from 'typedoc-nextra';
import { EntitySymbol } from './EntitySymbol';

export function Properties({ entity }: { entity: DocumentedClassProperty }) {
    return (
        <div className="space-y-3">
            <EntitySymbol type={'property'} id={`p-${entity.name}`} link>
                {entity.static ? <span className="text-base text-purple-600">static </span> : ''}
                {entity.readonly ? <span className="text-base text-rose-600">readonly </span> : ''}
                {entity.name}
            </EntitySymbol>
            <div>
                {entity.description ? <Paragraph>{entity.description}</Paragraph> : null}
                <div className="my-2">
                    Type: <Badge variant="outline">{entity.type}</Badge>
                </div>
            </div>
        </div>
    );
}
