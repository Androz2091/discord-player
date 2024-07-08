import { cn } from '@edge-ui/react';

export function Container({
    children,
    className,
}: React.PropsWithChildren<{
    className?: string;
}>) {
    return <div className={cn('container flex items-center justify-center flex-col', className)}>{children}</div>;
}
