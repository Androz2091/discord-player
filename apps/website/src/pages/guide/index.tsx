import '@code-hike/mdx/dist/index.css';
import { lazy, useEffect, useState } from 'react';
import { MDXProvider } from '@mdx-js/react';
import { ScrollTop } from '@/components/scrolltop/ScrollTop';
import { Container } from '@/components/layout/Container';
import {
    ScrollArea,
    SheetContent,
    SheetTrigger,
    Sheet,
    Heading,
    Blockquote,
    Paragraph,
    List,
    ListItem,
    Code,
    CodeBlock,
    Table,
    TableHead,
    TableHeader,
    TableRow,
    TableCell,
    cn,
    Loader
} from '@edge-ui/react';
import { VscBook } from 'react-icons/vsc';
import { PanelRightClose } from 'lucide-react';
import { useRouter } from 'next/router';
import { GuideItemList } from '@/components/guide/GuideItemList';
import Link from 'next/link';

const entries = {
    Welcome: {
        Welcome: lazy(() => import('./_guides/welcome/welcome.mdx'))
    },
    Examples: {
        'Adding Events': lazy(() => import('./_guides/examples/adding_events.mdx')),
        'Autocomplete Search': lazy(() => import('./_guides/examples/autocomplete_search.mdx')),
        'Common Actions': lazy(() => import('./_guides/examples/common_actions.mdx')),
        'Creating Custom Hooks': lazy(() => import('./_guides/examples/creating_custom_hooks.mdx')),
        'Getting Lyrics': lazy(() => import('./_guides/examples/getting_lyrics.mdx')),
        'Playing Local File': lazy(() => import('./_guides/examples/playing_local_file.mdx')),
        'Playing Raw Resource': lazy(() => import('./_guides/examples/playing_raw_resource.mdx')),
        'Shared Audio Player': lazy(() => import('./_guides/examples/shared_audio_player.mdx')),
        'Using Existing Voice Connection': lazy(() => import('./_guides/examples/using_existing_voice_connection.mdx')),
        'Voice Recording': lazy(() => import('./_guides/examples/voice_recording.mdx'))
    },
    Extractors: {
        'Creating Extractor': lazy(() => import('./_guides/extractors/creating_extractor.mdx')),
        'Setting Bridge Source': lazy(() => import('./_guides/extractors/set_bridge_source.mdx')),
        'Stream Sources': lazy(() => import('./_guides/extractors/stream_sources.mdx'))
    },
    FAQ: {
        'Common Errors': lazy(() => import('./_guides/faq/common_errors.mdx')),
        'How To Access Player': lazy(() => import('./_guides/faq/how_to_access_player.mdx')),
        Questions: lazy(() => import('./_guides/faq/questions.mdx'))
    },
    Filters: {
        'Audio Filters': lazy(() => import('./_guides/filters/audio_filters.mdx')),
        'Custom Filters': lazy(() => import('./_guides/filters/custom_filters.mdx'))
    },
    Hooks: {
        'Using Hooks': lazy(() => import('./_guides/hooks/using_hooks.mdx'))
    },
    Migrating: {
        'Migrating from v5': lazy(() => import('./_guides/migrating/migrating.mdx'))
    },
    YouTube: {
        'Using Cookies': lazy(() => import('./_guides/youtube/cookies.mdx')),
        'Using Proxy': lazy(() => import('./_guides/youtube/proxy.mdx'))
    }
};

const tableOfContent = Object.entries(entries);
const lgn = (p: string) => {
    return p?.match(/language-(\w+)/)?.[1] || 'text';
};

/* eslint-disable */
const mdxComponents = {
    h1: (props: any) => <Heading.H1 {...props} />,
    h2: (props: any) => <Heading.H2 {...props} />,
    h3: (props: any) => <Heading.H3 {...props} />,
    h4: (props: any) => <Heading.H4 {...props} />,
    h5: (props: any) => <Heading.H5 {...props} />,
    h6: (props: any) => <Heading.H6 {...props} />,
    p: (props: any) => <Paragraph {...props} />,
    blockquote: (props: any) => <Blockquote {...props} />,
    ul: (props: any) => <List {...props} />,
    li: (props: any) => <ListItem {...props} />,
    pre: (props: any) => <div {...props} />,
    a: (props: any) => <Link className="underline font-semibold text-teal-500 hover:text-teal-600" target="_blank" rel="noopener noreferrer" {...props} />,
    table: (props: any) => <Table {...props} className={cn(props.className, 'border')} />,
    thead: (props: any) => <TableHeader {...props} className={cn(props.className, 'bg-secondary')} />,
    th: (props: any) => <TableHead {...props} />,
    tr: (props: any) => <TableRow {...props} />,
    td: (props: any) => <TableCell {...props} />,
    code: (props: any) =>
        typeof props.children === 'string' && !props.children.includes('\n') ? (
            <Code {...props} />
        ) : (
            <CodeBlock lines={props.children.trim().includes('\n')} language={lgn(props.className)} {...props} />
        )
};
/* eslint-enable */

export default function Guide() {
    const router = useRouter();
    const { topic, page } = router.query;
    const [CurrentPage, setCurrentPage] = useState<(() => JSX.Element) | null>(null);

    useEffect(() => {
        if (!topic || !page) {
            return void router.replace('/guide?topic=Welcome&page=Welcome');
        }
        try {
            const el = entries[topic as keyof typeof entries][decodeURIComponent(page as string) as keyof (typeof entries)[keyof typeof entries]];
            setCurrentPage(el || null);
        } catch {
            setCurrentPage(null);
        }
    }, [topic, page, router]);

    const guideItems = tableOfContent.map(([name, contents]) => (
        <GuideItemList
            key={name}
            name={name}
            data={Object.keys(contents).map((m) => {
                return {
                    name: m
                };
            })}
            link={(page) => {
                return `/guide?topic=${encodeURIComponent(name)}&page=${encodeURIComponent(page)}`;
            }}
            icon={<VscBook className="h-5 w-5" />}
        />
    ));

    return (
        <Container>
            <div className="flex flex-row items-start w-full gap-5 mt-2">
                <div className="lg:border lg:p-2 rounded-lg lg:w-[20%] mb-5 gap-5">
                    <div className="hidden lg:flex flex-col gap-5 mt-5">
                        <ScrollArea className="max-h-screen">
                            <div className="space-y-3 max-h-[84vh]">{guideItems}</div>
                        </ScrollArea>
                    </div>
                    <div className="lg:hidden absolute left-0 top-[4.3rem]">
                        <Sheet>
                            <SheetTrigger className="sticky">
                                <PanelRightClose className="h-8 w-8" />
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[85%]">
                                <div className="flex flex-col gap-5 mt-5">
                                    <ScrollArea className="max-h-screen">
                                        <div className="space-y-3 max-h-[84vh]">{guideItems}</div>
                                    </ScrollArea>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
                <div className="flex-1 overflow-auto h-screen hidescrollbar mb-16">
                    <MDXProvider components={mdxComponents}>
                        {CurrentPage ? (
                            <CurrentPage />
                        ) : (
                            <div className="h-1/2 grid place-items-center">
                                <Loader variant="bars" className="h-10 w-10" />
                            </div>
                        )}
                    </MDXProvider>
                </div>
            </div>
            <ScrollTop />
        </Container>
    );
}
