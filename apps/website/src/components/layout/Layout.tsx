import Navbar from '../nav/Navbar';

export function AppLayout({ children }: React.PropsWithChildren) {
    return (
        <>
            <Navbar />
            <div>{children}</div>
        </>
    );
}
