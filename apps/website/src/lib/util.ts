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
