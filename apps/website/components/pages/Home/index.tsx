import { Space } from '@mantine/core';
import { Header } from './Header';
import { Installation } from './Installation';
import { Packages } from './Packages';

export function HomePage() {
    return (
        <div>
            <Header />
            <Space h="xs" />
            <Installation />
            <Space h="xl" />
            <Packages />
        </div>
    );
}
