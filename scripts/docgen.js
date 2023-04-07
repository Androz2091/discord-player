/* eslint-disable */
const { createDocumentation } = require('typedoc-nextra');
const { rimraf } = require('rimraf');
const { writeFile, readdir } = require('fs-extra');
const path = require('path');

const DOCS = `${__dirname}/../docs`;
const OUT = `${__dirname}/../apps/website/pages/docs`;

async function main() {
    await rimraf(OUT);

    console.log('Generating documentation...');

    const guideFiles = await parseGuides();
    const res = await createDocumentation({
        custom: guideFiles,
        input: `${__dirname}/../`,
        output: OUT,
        extension: 'mdx',
        markdown: true
    });

    await writeGuideMeta(guideFiles);
    await writeDocsMeta();

    return res.metadata.generationMs.toFixed(2);
}

async function parseGuides() {
    const root = await readdir(DOCS);
    const list = (
        await Promise.all(
            root.map(async (dir) => {
                const files = await readdir(`${DOCS}/${dir}`);
                return files.map((file) => ({
                    name: file.replace(path.extname(file), '').toLowerCase().replace(/_|\W/g, '-').trim(),
                    path: `${DOCS}/${dir}/${file}`,
                    category: 'guides'
                }));
            })
        )
    ).flat(1);

    list.push({
        name: 'welcome',
        category: 'guides',
        path: `${__dirname}/../README.md`
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
}

async function writeGuideMeta(guideFiles) {
    const res = {};

    for (const guide of guideFiles) {
        res[guide.name] = getDisplayName(guide.name);
    }

    await writeFile(`${OUT}/guides/_meta.json`, JSON.stringify(res, null, 4));
}

async function writeDocsMeta() {
    const res = {
        classes: 'Classes',
        functions: 'Functions',
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
