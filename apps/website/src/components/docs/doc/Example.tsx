import { getExampleText } from '@/lib/util';
import { CodeBlock, Heading } from '@edge-ui/react';

export function Example({ item }: { item: { examples?: string[] } }) {
    if (!item.examples?.length) return <></>;

    return (
        <div className="space-y-3 mt-2">
            <Heading.H4>Examples</Heading.H4>

            {item.examples.map((example, idx) => {
                const data = getExampleText(example);

                return (
                    <CodeBlock key={idx} language={data.language} lines>
                        {data.code}
                    </CodeBlock>
                );
            })}
        </div>
    );
}
