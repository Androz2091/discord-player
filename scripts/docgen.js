/* eslint-disable */
const { createDocumentation } = require('typedoc-nextra');
const { rimraf } = require('rimraf');
const { writeFile } = require('fs-extra');

const DOCS = `${__dirname}/../docs`;
const OUT = `${__dirname}/../apps/website/pages/docs`;

const GuideFiles = [
    {
        name: 'welcome',
        category: 'guides',
        path: `${__dirname}/../README.md`
    },
    {
        name: 'v6-migration',
        category: 'guides',
        path: `${DOCS}/migrating/migrating.md`
    },
    {
        name: 'extractors-api',
        category: 'guides',
        path: `${DOCS}/extractors/extractor.md`
    },
    {
        name: 'stream-hooks',
        category: 'guides',
        path: `${DOCS}/extractors/create_stream.md`
    },
    {
        name: 'audio-filters',
        path: `${DOCS}/faq/custom_filters.md`,
        category: 'guides'
    },
    {
        name: 'slash-commands',
        path: `${DOCS}/faq/slash_commands.md`,
        category: 'guides'
    },
    {
        name: 'working-mechanism',
        path: `${DOCS}/faq/how_does_it_work.md`,
        category: 'guides'
    },
    {
        name: 'ratelimits',
        path: `${DOCS}/youtube/cookies.md`,
        category: 'guides'
    },
    {
        name: 'using-proxy',
        path: `${DOCS}/youtube/proxy.md`,
        category: 'guides'
    }
];

async function main() {
    await rimraf(OUT);

    console.log('Generating documentation...');

    const res = await createDocumentation({
        custom: GuideFiles,
        input: `${__dirname}/../`,
        output: OUT,
        extension: 'mdx',
        markdown: true
    });

    await writeGuideMeta();
    await writeDocsMeta();

    return res.metadata.generationMs.toFixed(2);
}

async function writeGuideMeta() {
    const res = {};

    for (const guide of GuideFiles) {
        res[guide.name] = getDisplayName(guide.name);
    }

    await writeFile(`${OUT}/guides/_meta.json`, JSON.stringify(res, null, 4));
}

async function writeDocsMeta() {
    const res = {
        classes: 'Classes',
        types: 'Interfaces',
        guides: 'Guides'
    };

    await writeFile(`${OUT}/_meta.json`, JSON.stringify(res, null, 4));
}

function getDisplayName(n = '') {
    return n
        .split('-')
        .map((m) => {
            return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
        })
        .join(' ');
}

main().then((r) => {
    console.log(`Successfully generated documentation in ${r}ms`);
}, console.error);
