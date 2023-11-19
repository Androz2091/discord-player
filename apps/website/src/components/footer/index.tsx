import Link from 'next/link';
import { TextMark } from '../assets/TextMark';
import { cn } from '@edge-ui/react';

export default function Footer() {
    return (
        <footer className="border-t py-4 px-16">
            <div className="flex items-start justify-around">
                <div className="flex flex-col items-center">
                    <TextMark />
                    <h2 className={cn('text-lg font-bold select-none')}>Discord Player</h2>
                </div>
                <div className="flex items-start gap-16">
                    <div className="flex items-start flex-col text-sm">
                        <h3 className="font-semibold">Links</h3>
                        <Link href="/docs" className="text-blue-500">
                            Documentation
                        </Link>
                        <Link href="/guide" className="text-blue-500">
                            Guides
                        </Link>
                        <Link href="/showcase" className="text-blue-500">
                            Showcase
                        </Link>
                    </div>
                    <div className="flex items-start flex-col text-sm">
                        <h3 className="font-semibold">Social</h3>
                        <Link href="https://github.com/Androz2091" className="text-blue-500">
                            GitHub
                        </Link>
                        <Link href="https://androz2091.fr/discord" className="text-blue-500">
                            Discord
                        </Link>
                    </div>
                    <div className="flex items-start flex-col text-sm">
                        <h3 className="font-semibold">About</h3>
                        <Link href="/privacy" className="text-blue-500">
                            Privacy Policy
                        </Link>
                        <Link href="/legal" className="text-blue-500">
                            Legal
                        </Link>
                        <Link href="/contributing" className="text-blue-500">
                            Contributing
                        </Link>
                    </div>
                </div>
            </div>
            <div className="flex flex-col items-center justify-center mt-6">
                <span className="text-sm text-muted font-medium">
                    Made with ❤️ by{' '}
                    <Link href="https://github.com/Androz2091" className="text-blue-500">
                        Androz2091
                    </Link>{' '}
                    and{' '}
                    <Link href="https://github.com/twlite" className="text-blue-500">
                        twlite
                    </Link>
                </span>
                <span className="text-sm text-muted">
                    © {new Date().getFullYear()}{' '}
                    <Link href="https://github.com/Androz2091" className="text-blue-500">
                        Androz2091
                    </Link>{' '}
                    - Not affiliated with{' '}
                    <Link className="text-blue-500" href="https://discord.com">
                        Discord
                    </Link>
                </span>
            </div>
        </footer>
    );
}

/*
<footer className="border-t py-4">
            <div className="flex items-center justify-around">
                <div>
                    <Link href="/" className="mr-6 flex items-center space-x-2">
                        <TextMark className="h-10 w-10" />
                    </Link>
                </div>
                <div className="flex items-start gap-8">
                    
                </div>
            </div>
            <div className="flex flex-col items-start justify-start mt-3">
                <span className="text-sm text-muted font-medium">
                    Made with ❤️ by{' '}
                    <Link href="https://github.com/Androz2091" className="text-blue-500">
                        Androz2091
                    </Link>{' '}
                    and{' '}
                    <Link href="https://github.com/twlite" className="text-blue-500">
                        twlite
                    </Link>
                </span>
                <span className="text-sm text-muted">
                    © {new Date().getFullYear()}{' '}
                    <Link href="https://github.com/Androz2091" className="text-blue-500">
                        Androz2091
                    </Link>
                </span>
            </div>
        </footer>
*/
