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
        name: 'supported-sources',
        category: 'guides',
        path: `${DOCS}/extractors/sources.md`
    },
    {
        name: 'playing-local-file',
        category: 'guides',
        path: `${DOCS}/examples/playing_local_file.md`
    },
    {
        name: 'playing-raw-resource',
        category: 'guides',
        path: `${DOCS}/examples/playing_raw_resource.md`
    },
    {
        name: 'voice-recording',
        category: 'guides',
        path: `${DOCS}/examples/voice_recording.md`
    },
    {
        name: 'stream-hooks',
        category: 'guides',
        path: `${DOCS}/extractors/stream_hooks.md`
    },
    {
        name: 'common-problems',
        category: 'guides',
        path: `${DOCS}/faq/common_errors.md`
    },
    {
        name: 'accessing-player',
        category: 'guides',
        path: `${DOCS}/faq/how_to_access_player.md`
    },
    {
        name: 'audio-filters',
        path: `${DOCS}/filters/audio_filters.md`,
        category: 'guides'
    },
    {
        name: 'custom-audio-filters',
        path: `${DOCS}/filters/custom_filters.md`,
        category: 'guides'
    },
    {
        name: 'preventing-ratelimits',
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
