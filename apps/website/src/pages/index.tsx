import { Heading, Card, CardHeader, CardTitle, CardDescription } from '@edge-ui/react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { features, tools } from '@/lib/constants';
import { Container } from '@/components/layout/Container';
import Hero from '@/components/homepage/Hero';
import { Section } from '@/components/homepage/Section';
import { CardGrid } from '@/components/homepage/CardGrid';

export default function Main() {
    return (
        <Container>
            <Hero />
            <Section>
                <Heading.H2>Why choose discord-player?</Heading.H2>
                <CardGrid>
                    {features.map((feature) => {
                        return (
                            <Card className="bg-transparent" key={feature.title}>
                                <CardHeader>
                                    <CardTitle>{feature.title}</CardTitle>
                                    <CardDescription>{feature.description}</CardDescription>
                                </CardHeader>
                            </Card>
                        );
                    })}
                </CardGrid>
            </Section>
            <Section>
                <Heading.H2>Built with powerful tools</Heading.H2>
                <CardGrid>
                    {tools.map((tool) => {
                        return (
                            <Link href={tool.link} target="_blank" rel="noopener noreferrer" key={tool.title}>
                                <Card className="bg-transparent cursor-pointer">
                                    <CardHeader>
                                        <CardTitle>
                                            <span className="flex flex-row gap-1 items-center">
                                                {tool.title} <ExternalLink className="h-4 w-4" />
                                            </span>
                                        </CardTitle>
                                        <CardDescription>{tool.description}</CardDescription>
                                    </CardHeader>
                                </Card>
                            </Link>
                        );
                    })}
                </CardGrid>
            </Section>
        </Container>
    );
}
