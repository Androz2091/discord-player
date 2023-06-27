import { Badge, Heading } from '@edge-ui/react';
import type { DocumentedClass } from 'typedoc-nextra';
import { Constructor } from '../entities/Constructor';
import { EntitySymbol } from '../entities/EntitySymbol';
import { Function } from '../entities/Function';
import { Properties } from '../entities/Properties';
import { Type } from '../entities/Type';

export function ClassRenderer({ entity }: { entity: DocumentedClass }) {
    console.log(entity);
    return (
        <>
            <EntitySymbol type={'class'} id={`c-${entity.name}`} link source={entity.metadata?.url}>
                {entity.name} {entity.deprecated ? <Badge variant="destructive">Deprecated</Badge> : null}
            </EntitySymbol>
            {entity.extends ? <Type prefix="extends" types={[entity.extends]} /> : ''}
            <Constructor item={entity.constructor!} />
            {entity.properties.length ? (
                <div className="flex flex-col gap-4 mt-5">
                    <Heading.H3>Properties</Heading.H3>
                    {entity.properties.map((property, i) => (
                        <Properties entity={property} key={`${i}-${entity.name}-${property.name}`} />
                    ))}
                </div>
            ) : null}
            {entity.methods.length ? (
                <div className="flex flex-col gap-4 mt-5">
                    <Heading.H3>Methods</Heading.H3>
                    {entity.methods.map((method) => (
                        <Function key={`${entity.name}-${method.name}`} entity={method} />
                    ))}
                </div>
            ) : null}
        </>
    );
}
