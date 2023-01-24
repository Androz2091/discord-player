/* eslint-disable */
const { createDocumentation } = require('typedoc-nextra');
const { rimraf } = require('rimraf');
const { copyFile } = require('fs-extra');

const DOCS = `${__dirname}/../docs`;
const OUT = `${__dirname}/../apps/website/pages/docs`;

async function main() {
    await rimraf(OUT);

    console.log('Generating documentation...');

    const res = await createDocumentation({
        custom: [
            {
                name: 'Welcome',
                category: 'guide',
                path: `${__dirname}/../README.md`
            },
            {
                name: 'Migrating-to-v5',
                category: 'guide',
                path: `${DOCS}/migrating/migrating.md`
            },
            {
                name: 'Extractors-API',
                category: 'guide',
                path: `${DOCS}/extractors/extractor.md`
            },
            {
                name: 'Creating-Stream',
                category: 'guide',
                path: `${DOCS}/extractors/create_stream.md`
            },
            {
                name: 'Custom-Filters',
                path: `${DOCS}/faq/custom_filters.md`,
                category: 'guide'
            },
            {
                name: 'Slash-Commands',
                path: `${DOCS}/faq/slash_commands.md`,
                category: 'guide'
            },
            {
                name: 'How-Does-It-Work',
                path: `${DOCS}/faq/how_does_it_work.md`,
                category: 'guide'
            },
            {
                name: 'Using-Cookies',
                path: `${DOCS}/youtube/cookies.md`,
                category: 'guide'
            },
            {
                name: 'Using-Proxy',
                path: `${DOCS}/youtube/proxy.md`,
                category: 'guide'
            }
        ],
        input: `${__dirname}/../`,
        output: OUT,
        extension: 'mdx',
        markdown: true
    });

    await copyFile(`${__dirname}/../README.md`, `${__dirname}/../apps/website/pages/index.mdx`);

    return res.metadata.generationMs.toFixed(2);
}

main().then((r) => {
    console.log(`Successfully generated documentation in ${r}ms`);
}, console.error);
