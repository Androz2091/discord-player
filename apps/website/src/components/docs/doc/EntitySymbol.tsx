import { Heading } from '@edge-ui/react';
import { VscSymbolClass, VscSymbolInterface, VscSymbolMethod } from 'react-icons/vsc';

export function EntitySymbol({ type, children }: React.PropsWithChildren<{ type: 'class' | 'function' | 'interface' }>) {
    switch (type) {
        case 'class':
            return (
                <Heading.H3 className="flex items-center gap-4">
                    <VscSymbolClass />
                    {children}
                </Heading.H3>
            );
        case 'function':
            return (
                <Heading.H3 className="flex items-center gap-4">
                    <VscSymbolMethod />
                    {children}
                </Heading.H3>
            );
        case 'interface':
            return (
                <Heading.H3 className="flex items-center gap-4">
                    <VscSymbolInterface />
                    {children}
                </Heading.H3>
            );
        default:
            return <Heading.H3>{children}</Heading.H3>;
    }
}
