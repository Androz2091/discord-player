import { useState } from 'react';
import { HeadingMeta } from '@/components/heading';
import { CardGrid } from '@/components/layout/CardGrid';
import { Container } from '@/components/layout/Container';
import { ShowcaseResource } from '@/data/showcase';
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, Heading, Paragraph, Input } from '@edge-ui/react';
import { ExternalLink, Upload } from 'lucide-react';
import Link from 'next/link';

const resURL = 'https://github.com/Androz2091/discord-player/blob/master/apps/website/src/data/showcase.ts';

export default function Showcase() {
    const [searchTerm, setSearchTerm] = useState<string>('');

    const filteredBots = ShowcaseResource.bots.filter((bot) => bot.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredExtractors = ShowcaseResource.extractors.filter((extractor) => extractor.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <Container>
            <HeadingMeta title="Showcase | Discord Player" description="A curated list of resources like open-source music bots and extractors, built by the Discord Player community." />
            <div className="mt-5 mb-10 space-y-5 w-full">
                <div>
                    <Heading.H1>Showcase</Heading.H1>
                    <Paragraph>A curated list of resources like open-source music bots and extractors, built by the Discord Player community.</Paragraph>
                    <div className="mt-3">
                        <Link href={resURL} target="_blank" rel="noopener noreferrer">
                            <Button className="w-full md:w-auto gap-1">
                                <Upload className="h-5 w-5" />
                                Add your own
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="py-5 felx justify-center">
                    <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>

                {filteredExtractors.length > 0 && (
                    <div className="space-y-2">
                        <Heading.H2>Extractors</Heading.H2>
                        <CardGrid>
                            {filteredExtractors.map((ext) => (
                                <Link href={ext.url} target="_blank" rel="noopener noreferrer" key={ext.name}>
                                    <Card className="bg-transparent cursor-pointer">
                                        <CardHeader>
                                            <CardTitle>
                                                <span className="flex flex-row gap-1 items-center">
                                                    {ext.name} <ExternalLink className="h-4 w-4" />
                                                </span>
                                            </CardTitle>
                                            <CardDescription>{ext.description}</CardDescription>
                                        </CardHeader>
                                    </Card>
                                </Link>
                            ))}
                        </CardGrid>
                    </div>
                )}

                {filteredBots.length > 0 && (
                    <div className="space-y-2 pt-5">
                        <Heading.H2>Music Bots</Heading.H2>
                        <CardGrid>
                            {filteredBots.map((bot) => (
                                <Card className="bg-transparent" key={bot.name}>
                                    <CardHeader>
                                        <CardTitle className="space-y-2">
                                            <Link href={bot.url} target="_blank" rel="noopener noreferrer">
                                                <span className="flex flex-row gap-1 items-center cursor-pointer">
                                                    {bot.name} <ExternalLink className="h-4 w-4" />
                                                </span>
                                            </Link>
                                            <Badge variant="default">Discord Player {bot.version}</Badge>
                                        </CardTitle>
                                        <CardDescription>{bot.description}</CardDescription>
                                    </CardHeader>
                                </Card>
                            ))}
                        </CardGrid>
                    </div>
                )}

                {!filteredBots.length && !filteredExtractors.length && <Heading.H3 className="text-center">No result!</Heading.H3>}
                {/* <div>
                    <Heading.H2>Extractors</Heading.H2>
                    <Table className="border">
                        <TableHeader className="bg-secondary">
                            <TableRow>
                                <TableHead className="w-[100px]">S.N.</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead className="w-[700px]">Description</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {ShowcaseResource.extractors.map((ext, i) => (
                                <TableRow key={ext.name}>
                                    <TableCell className="font-medium">{i + 1}.</TableCell>
                                    <TableCell>
                                        <Link href={ext.url} target="_blank" rel="noreferrer noopener" className="text-teal-500 cursor-pointer font-semibold">
                                            {ext.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Paragraph>{ext.description}</Paragraph>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <div className="overflow-auto">
                    <Heading.H2>Music Bots</Heading.H2>
                    <Table className="border">
                        <TableHeader className="bg-secondary">
                            <TableRow>
                                <TableHead className="w-[100px]">S.N.</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead className="max-w-[700px]">Description</TableHead>
                                <TableHead className="w-[190px]">Discord Player Version</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {ShowcaseResource.bots.map((bot, i) => (
                                <TableRow key={bot.name}>
                                    <TableCell className="font-medium">{i + 1}.</TableCell>
                                    <TableCell>
                                        <Link href={bot.url} target="_blank" rel="noreferrer noopener" className="text-teal-500 cursor-pointer font-semibold">
                                            {bot.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Paragraph>{bot.description}</Paragraph>
                                    </TableCell>
                                    <TableCell className="text-center">{bot.version}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div> */}
            </div>
        </Container>
    );
}
