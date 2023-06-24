import { Container } from '@/components/layout/Container';
import { Button, Heading } from '@edge-ui/react';
import Link from 'next/link';

export default function InternalError() {
    return (
        <Container className="min-h-[70vh] space-y-3">
            <div className="text-center">
                <Heading.H1 className="text-9xl">500</Heading.H1>
                <Heading.H3 className="font-normal text-muted-foreground">Something went wrong!</Heading.H3>
            </div>
            <Link href="/">
                <Button>Return Home</Button>
            </Link>
        </Container>
    );
}
