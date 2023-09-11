import { Container } from '@/components/layout/Container';
import { Loader } from '@edge-ui/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function DocumentationEntryPoint() {
    const router = useRouter();

    useEffect(() => {
        router.push(`/docs/discord-player/class/Player`);
    }, []);

    return (
        <Container>
            <div className="grid place-items-center h-[80vh]">
                <Loader variant="bubble" className="h-16 w-16" />
            </div>
        </Container>
    );
}
