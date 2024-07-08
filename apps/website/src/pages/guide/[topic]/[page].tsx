import '@code-hike/mdx/dist/index.css';
import { lazy, useMemo } from 'react';
import { MDXProvider } from '@mdx-js/react';
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
    Loader,
} from '@edge-ui/react';
import { VscBook } from 'react-icons/vsc';
import { PanelRightClose } from 'lucide-react';
import { useRouter } from 'next/router';
import { GuideItemList } from '@/components/guide/GuideItemList';
import Link from 'next/link';
import { HeadingMeta } from '@/components/heading';

const pages = [
    {
        name: 'welcome',
        displayName: 'Welcome',
        pages: [
            {
                name: 'welcome',
                displayName: 'Welcome',
                component: lazy(() => import('../_guides/welcome/welcome.mdx')),
            },
        ],
    },
    {
        name: 'faq',
        displayName: 'FAQ',
        pages: [
            {
                name: 'attachment-metadata',
                displayName: 'Attachments Metadata',
                component: lazy(() => import('../_guides/faq/attachment_metadata.mdx')),
            },
            {
                name: 'common-errors',
                displayName: 'Common Errors',
                component: lazy(() => import('../_guides/faq/common_errors.mdx')),
            },
            {
                name: 'disable-youtube',
                displayName: 'Disabling YouTube',
                component: lazy(() => import('../_guides/faq/disable_youtube.mdx')),
            },
            {
                name: 'how-to-access-player',
                displayName: 'How To Access Player',
                component: lazy(() => import('../_guides/faq/how_to_access_player.mdx')),
            },
            {
                name: 'performance-optimization',
                displayName: 'Performance Optimizations',
                component: lazy(() => import('../_guides/faq/performance_optimization.mdx')),
            },
            {
                name: 'serialization-and-deserialization',
                displayName: 'Serialization and Deserialization',
                component: lazy(() => import('../_guides/faq/serialization_and_deserialization.mdx')),
            },
        ],
    },
    {
        name: 'examples',
        displayName: 'Examples',
        pages: [
            {
                name: 'adding-events',
                displayName: 'Adding Events',
                component: lazy(() => import('../_guides/examples/adding_events.mdx')),
            },
            {
                name: 'autocomplete-search',
                displayName: 'Autocomplete Search',
                component: lazy(() => import('../_guides/examples/autocomplete_search.mdx')),
            },
            {
                name: 'common-actions',
                displayName: 'Common Actions',
                component: lazy(() => import('../_guides/examples/common_actions.mdx')),
            },
            {
                name: 'creating-custom-hooks',
                displayName: 'Creating Custom Hooks',
                component: lazy(() => import('../_guides/examples/creating_custom_hooks.mdx')),
            },
            {
                name: 'getting-lyrics',
                displayName: 'Getting Lyrics',
                component: lazy(() => import('../_guides/examples/getting_lyrics.mdx')),
            },
            {
                name: 'playing-local-file',
                displayName: 'Playing Local File',
                component: lazy(() => import('../_guides/examples/playing_local_file.mdx')),
            },
            {
                name: 'playing-raw-resource',
                displayName: 'Playing Raw Resource',
                component: lazy(() => import('../_guides/examples/playing_raw_resource.mdx')),
            },
            {
                name: 'shared-audio-player',
                displayName: 'Shared Audio Player',
                component: lazy(() => import('../_guides/examples/shared_audio_player.mdx')),
            },
            {
                name: 'using-existing-voice-connection',
                displayName: 'Using Existing Voice Connection',
                component: lazy(() => import('../_guides/examples/using_existing_voice_connection.mdx')),
            },
            {
                name: 'voice-recording',
                displayName: 'Voice Recording',
                component: lazy(() => import('../_guides/examples/voice_recording.mdx')),
            },
        ],
    },
    {
        name: 'hooks',
        displayName: 'Hooks',
        pages: [
            {
                name: 'using-hooks',
                displayName: 'Using Hooks',
                component: lazy(() => import('../_guides/hooks/using_hooks.mdx')),
            },
        ],
    },
    {
        name: 'extractors',
        displayName: 'Extractors',
        pages: [
            {
                name: 'creating-extractor',
                displayName: 'Creating Extractor',
                component: lazy(() => import('../_guides/extractors/creating_extractor.mdx')),
            },
            {
                name: 'set-bridge-source',
                displayName: 'Setting Bridge Source',
                component: lazy(() => import('../_guides/extractors/set_bridge_source.mdx')),
            },
            {
                name: 'stream-sources',
                displayName: 'Stream Sources',
                component: lazy(() => import('../_guides/extractors/stream_sources.mdx')),
            },
        ],
    },
    {
        name: 'youtube',
        displayName: 'YouTube Ratelimits',
        pages: [
            {
                name: 'cookies',
                displayName: 'Using Cookies',
                component: lazy(() => import('../_guides/youtube/cookies.mdx')),
            },
            {
                name: 'ip-rotation',
                displayName: 'IP Rotation',
                component: lazy(() => import('../_guides/youtube/ip_rotation.mdx')),
            },
            {
                name: 'proxy',
                displayName: 'Using Proxy',
                component: lazy(() => import('../_guides/youtube/proxy.mdx')),
            },
        ],
    },
    {
        name: 'filters',
        displayName: 'Filters',
        pages: [
            {
                name: 'audio-filters',
                displayName: 'Audio Filters',
                component: lazy(() => import('../_guides/filters/audio_filters.mdx')),
            },
            {
                name: 'custom-filters',
                displayName: 'Custom Filters',
                component: lazy(() => import('../_guides/filters/custom_filters.mdx')),
            },
        ],
    },

    {
        name: 'migrating',
        displayName: 'Migrating',
        pages: [
            {
                name: 'migrating-from-v5',
                displayName: 'Migrating from v5',
                component: lazy(() => import('../_guides/migrating/migrating.mdx')),
            },
        ],
    },
];

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
    p: (props: any) => <Paragraph {...props} className="[&:not(:first-child)]:mt-2 mb-2" />,
    blockquote: (props: any) => <Blockquote {...props} />,
    ul: (props: any) => <List {...props} />,
    li: (props: any) => <ListItem {...props} />,
    pre: (props: any) => <div {...props} />,
    a: (props: any) => (
        <Link
            className="underline font-semibold text-teal-500 hover:text-teal-600"
            target="_blank"
            rel="noopener noreferrer"
            {...props}
        />
    ),
    table: (props: any) => <Table {...props} className={cn(props.className, 'border')} />,
    thead: (props: any) => <TableHeader {...props} className={cn(props.className, 'bg-secondary')} />,
    th: (props: any) => <TableHead {...props} />,
    tr: (props: any) => <TableRow {...props} />,
    td: (props: any) => <TableCell {...props} />,
    code: (props: any) =>
        typeof props.children === 'string' && !props.children.includes('\n') ? (
            <Code {...props} className="bg-zinc-600/80 text-gray-200" />
        ) : (
            <CodeBlock lines={props.children.trim().includes('\n')} language={lgn(props.className)} {...props} />
        ),
};
/* eslint-enable */

export default function Guide() {
    const router = useRouter();
    const { topic, page } = router.query;
    const currentPage = useMemo(() => {
        if (!topic || !page) return null;
        const t = pages.find((m) => m.name === topic);
        if (!t) return null;
        const p = t.pages.find((m) => m.name === page);
        if (!p) return null;

        return {
            component: p.component,
            topic: t.displayName,
            page: p.displayName,
        };
    }, [topic, page]);

    const guideItems = pages.map((page) => (
        <GuideItemList
            key={page.name}
            name={page.displayName}
            id={page.name}
            data={page.pages.map((m) => {
                return {
                    name: m.displayName,
                    id: m.name,
                };
            })}
            link={(doc) => {
                return `/guide/${encodeURIComponent(page.name)}/${encodeURIComponent(doc)}`;
            }}
            icon={<VscBook className="h-5 w-5" />}
        />
    ));

    return (
        <Container>
            <HeadingMeta
                title={
                    currentPage?.topic && currentPage.page
                        ? `${currentPage.page} - ${currentPage.topic}`
                        : 'Discord Player'
                }
                description={
                    currentPage?.topic && currentPage.page
                        ? `This guide explains about ${currentPage.page} on the topic ${currentPage.topic}.`
                        : `The official guidebook of Discord Player.`
                }
            />
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
                        {currentPage ? (
                            <currentPage.component />
                        ) : (
                            <div className="h-1/2 grid place-items-center">
                                <Loader variant="bubble" className="h-16 w-16" />
                            </div>
                        )}
                    </MDXProvider>
                </div>
            </div>
        </Container>
    );
}
