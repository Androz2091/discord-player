import { Container } from '@/components/layout/Container';
// import { Sidebar } from '@/components/sidebar';

export default function DocsTestPage() {
    return (
        <Container>
            <div className="grid grid-cols-1 lg:grid-cols-3 grid-flow-row w-full">
                <div>
                    <div className="hidden lg:flex">Sidebar</div>
                    <div className="lg:hidden">
                        {/* <Sidebar /> */}
                        open
                    </div>
                </div>
                <div className="lg:col-span-2">Content Area</div>
            </div>
        </Container>
    );
}
