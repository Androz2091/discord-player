import Footer from '../footer';
import Navbar from '../nav/Navbar';

export function AppLayout({ children }: React.PropsWithChildren) {
    return (
        <>
            <Navbar />
            <div className="transition-all">{children}</div>
            <Footer />
        </>
    );
}
