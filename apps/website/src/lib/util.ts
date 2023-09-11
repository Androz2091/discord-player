const regex = /```(?<language>\w+)?\n(?<code>[\s\S]*?)```/;

export function getExampleText(src: string) {
    const match = regex.exec(src);

    return { language: match?.groups?.language || 'text', code: match?.groups?.code || src };
}

export function makeTypeParams(str: string) {
    return str.split(' | ').flatMap((m) => splitType(m));
}

export function splitType(str: string) {
    const result: string[] = [];
    let tempStr = '';
    for (let i = 0; i < str.length; i++) {
        if (str[i] === '<' || str[i] === '>') {
            if (tempStr.length > 0) {
                result.push(tempStr);
                tempStr = '';
            }
            result.push(str[i]);
        } else {
            tempStr += str[i];
        }
    }
    if (tempStr.length > 0) {
        result.push(tempStr);
    }
    return result;
}

export function cleanupTypes(t: string[]) {
    return t
        .filter((f) => f !== ' ' && f.trim().length)
        .map((t, i, a) => {
            t = t.replace(/\\|,\|/g, '');
            if (i === a.length - 1 || ['keyof', 'typeof'].includes(t)) return t;
            if (a[i + 1] != null && ['<', '>', ':', ';', '[', ']', ')', "'", '"'].includes(a[i + 1])) return t;
            if (!['=>'].includes(a[i]) && />|[a-zA-Z]|\}/.test(t)) {
                return [t, '|'];
            }
            return t;
        })
        .flat(2);
}
