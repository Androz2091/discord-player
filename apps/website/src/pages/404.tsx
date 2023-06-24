import { Container } from '@/components/layout/Container';
import { Button, Heading } from '@edge-ui/react';
import Link from 'next/link';

export default function NotFound() {
    return (
        <Container className="min-h-[70vh] space-y-3">
            <div className="text-center">
                <Heading.H1 className="text-9xl">404</Heading.H1>
                <Heading.H3 className="font-normal text-muted-foreground">Page not found!</Heading.H3>
            </div>
            <Link href="/">
                <Button>Return Home</Button>
            </Link>
        </Container>
    );
}
