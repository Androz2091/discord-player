import { DocsContextProvider } from '@/lib/context';
import Navbar from '../nav/Navbar';

export function AppLayout({ children }: React.PropsWithChildren) {
    return (
        <DocsContextProvider>
            <Navbar />
            <div className="transition-all">{children}</div>
        </DocsContextProvider>
    );
}
