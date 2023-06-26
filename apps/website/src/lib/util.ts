const regex = /```(?<language>\w+)?\n(?<code>[\s\S]*?)```/;

export function getExampleText(src: string) {
    const match = regex.exec(src);

    return { language: match?.groups?.language || 'text', code: match?.groups?.code || src };
}
