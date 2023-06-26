export function CardGrid({ children }: React.PropsWithChildren) {
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 grid-flow-row gap-8">{children}</div>;
}
