import { Badge, Heading } from '@edge-ui/react';
import type { DocumentedClass } from 'typedoc-nextra';
import { Constructor } from '../doc/Constructor';
import { EntitySymbol } from '../doc/EntitySymbol';
import { Function } from '../doc/Function';
import { Properties } from '../doc/Properties';

export function ClassRenderer({ entity }: { entity: DocumentedClass }) {
    return (
        <>
            <EntitySymbol type={'class'} id={`c-${entity.name}`} link>
                {entity.name}
                {entity.extends ? ` extends ${entity.extends}` : ''} {entity.deprecated ? <Badge variant="destructive">Deprecated</Badge> : null}
            </EntitySymbol>
            <Constructor item={entity.constructor!} />
            {entity.properties.length ? (
                <div className="flex flex-col gap-4 mt-5">
                    <Heading.H3>Properties</Heading.H3>
                    {entity.properties.map((property) => (
                        <Properties entity={property} key={property.name} />
                    ))}
                </div>
            ) : null}
            {entity.methods.length ? (
                <div className="flex flex-col gap-4 mt-5">
                    <Heading.H3>Methods</Heading.H3>
                    {entity.methods.map((method) => (
                        <Function key={method.name} entity={method} />
                    ))}
                </div>
            ) : null}
        </>
    );
}
