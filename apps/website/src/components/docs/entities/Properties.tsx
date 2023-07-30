import { inter } from '@/lib/constants';
import { makeTypeParams } from '@/lib/util';
import { Badge, Paragraph } from '@edge-ui/react';
import type { DocumentedClassProperty } from 'typedoc-nextra';
import { EntitySymbol } from './EntitySymbol';
import { Type } from './Type';

export function Properties({ entity }: { entity: DocumentedClassProperty }) {
    return (
        <div className="space-y-3">
            <EntitySymbol type={'property'} id={`p-${entity.name}`} link source={entity.metadata?.url}>
                {entity.static ? <span className="text-base text-purple-600">static </span> : ''}
                {entity.readonly ? <span className="text-base text-rose-600">readonly </span> : ''}
                {entity.name}
                {entity.deprecated ? <Badge variant="destructive">Deprecated</Badge> : null}
            </EntitySymbol>
            <div>
                {entity.description ? (
                    <Paragraph>
                        <pre className={inter.className}>{entity.description}</pre>
                    </Paragraph>
                ) : null}
                <div className="my-2">
                    <Type types={entity.rawType || entity.type ? makeTypeParams(entity.type!) : ['any']} prefix="Type:" />
                </div>
            </div>
        </div>
    );
}
