import { Container } from '@/components/layout/Container';
import { DocumentationStore } from '@/lib/store';
import { Loader } from '@edge-ui/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function DocumentationEntryPoint() {
    const router = useRouter();
    const { libraries } = DocumentationStore;

    useEffect(() => {
        if (!router.query.package) return;
        const pkg = libraries.find((lib) => lib.name === router.query.package);
        if (!pkg) return;

        const name = pkg.name;
        const type = pkg.classes.length ? 'class' : pkg.types.length ? 'type' : pkg.functions.length ? 'function' : '';
        const target = pkg.classes.length ? pkg.classes[0].data.name : pkg.types.length ? pkg.types[0].data.name : pkg.functions.length ? pkg.functions[0].data.name : '';

        if (!target || !type) return;

        router.push(`/docs/${encodeURIComponent(name)}/${encodeURIComponent(type)}/${encodeURIComponent(target)}`);
    }, [router.query.package]);

    return (
        <Container>
            <div className="grid place-items-center h-[80vh]">
                <Loader variant="bubble" className="h-16 w-16" />
            </div>
        </Container>
    );
}
