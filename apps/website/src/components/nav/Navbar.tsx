import { GitHubIcon, DiscordIcon, useTheme, cn, Sheet, SheetTrigger, SheetContent } from '@edge-ui/react';
import Link from 'next/link';
import { SunIcon, MoonIcon, Menu } from 'lucide-react';
import { TextMark } from '../assets/TextMark';
import { useRouter } from 'next/router';
import { SearchBox } from '../searchbox/SearchBox';

export default function Navbar() {
    const { isDark, toggle } = useTheme();
    const { pathname } = useRouter();

    return (
        <div className="border-b">
            <div className="container py-2 hidden lg:flex">
                <div className="mr-4 hidden md:flex justify-between w-full">
                    <div className="flex items-center">
                        <Link href="/" className="mr-6 flex items-center space-x-2">
                            <TextMark className="h-10 w-10" />
                        </Link>
                        <nav className="flex items-center space-x-6 text-sm font-medium">
                            <Link href="/docs" className={cn('transition-colors hover:text-foreground/80', pathname === '/docs' ? 'text-foreground font-bold' : 'text-foreground/60')}>
                                Documentation
                            </Link>
                            <Link href="/guide" className={cn('transition-colors hover:text-foreground/80', pathname?.startsWith('/guide') ? 'text-foreground font-bold' : 'text-foreground/60')}>
                                Guide
                            </Link>
                            <Link href="/showcase" className={cn('transition-colors hover:text-foreground/80', pathname?.startsWith('/showcase') ? 'text-foreground font-bold' : 'text-foreground/60')}>
                                Showcase
                            </Link>
                            <Link href={'https://github.com/androz2091/discord-player'} className={cn('hidden text-foreground/60 transition-colors hover:text-foreground/80 lg:block')}>
                                GitHub
                            </Link>
                        </nav>
                    </div>
                    <div className="flex items-center gap-5">
                        <SearchBox />
                        <div className="flex flex-row items-center gap-4">
                            <Link href="https://github.com/androz2091/discord-player" target="_blank">
                                <span className="sr-only">GitHub</span>
                                <GitHubIcon className="h-5 w-5 cursor-pointer" />
                            </Link>
                            <Link href="https://androz2091.fr/discord">
                                <span className="sr-only">Discord</span>
                                <DiscordIcon className="h-5 w-5 cursor-pointer" />
                            </Link>
                            <button aria-label="Toggle Theme" onClick={toggle}>
                                {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <MobileNav />
        </div>
    );
}

function MobileNav() {
    const { pathname } = useRouter();
    const theme = useTheme();

    return (
        <div className="lg:hidden p-2 flex items-center justify-between">
            <TextMark className="h-10 w-10" />
            <div className="flex flex-row items-center gap-4">
                <SearchBox />
                <Sheet>
                    <SheetTrigger>
                        <Menu className="h-8 w-8" />
                    </SheetTrigger>
                    <SheetContent side="left">
                        <div className="h-full relative">
                            <nav className="flex flex-col justify-start space-y-6 text-sm font-medium">
                                <Link href="/" className={cn('transition-colors hover:text-foreground/80', pathname === '/' ? 'text-foreground font-bold' : 'text-foreground/60')}>
                                    Home
                                </Link>
                                <Link href="/docs" className={cn('transition-colors hover:text-foreground/80', pathname === '/docs' ? 'text-foreground font-bold' : 'text-foreground/60')}>
                                    Documentation
                                </Link>
                                <Link href="/guide" className={cn('transition-colors hover:text-foreground/80', pathname?.startsWith('/guide') ? 'text-foreground font-bold' : 'text-foreground/60')}>
                                    Guide
                                </Link>
                                <Link
                                    href="/showcase"
                                    className={cn('transition-colors hover:text-foreground/80', pathname?.startsWith('/showcase') ? 'text-foreground font-bold' : 'text-foreground/60')}
                                >
                                    Showcase
                                </Link>
                                <Link href={'https://github.com/androz2091/discord-player'} className={cn('text-foreground/60 transition-colors hover:text-foreground/80')}>
                                    GitHub
                                </Link>
                            </nav>
                            <div className="absolute w-full bottom-0 border-t pt-3">
                                <div className="flex flex-row items-center justify-between ">
                                    <Link href="https://github.com/androz2091/discord-player" target="_blank">
                                        <span className="sr-only">GitHub</span>
                                        <GitHubIcon className="h-5 w-5 cursor-pointer" />
                                    </Link>
                                    <Link href="https://androz2091.fr/discord">
                                        <span className="sr-only">Discord</span>
                                        <DiscordIcon className="h-5 w-5 cursor-pointer" />
                                    </Link>
                                    <button aria-label="Toggle Theme" onClick={theme.toggle}>
                                        {theme.isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </div>
    );
}
