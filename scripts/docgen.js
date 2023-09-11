/* eslint-disable */
const { createDocumentation } = require('typedoc-nextra');
const { writeFile } = require('fs-extra');
const path = require('path');

const docs_destination = `${__dirname}/../apps/website/src/data`;

async function main() {
    console.log('Generating documentation...');

    const res = await createDocumentation({
        input: `${__dirname}/../`,
        markdown: false,
        noEmit: true,
        print: false
    });

    await writeFile(path.join(docs_destination, 'docs.json'), JSON.stringify(res));

    return res.metadata.generationMs.toFixed(2);
}

main().then((r) => {
    console.log(`Successfully generated documentation in ${r}ms`);
}, console.error);
