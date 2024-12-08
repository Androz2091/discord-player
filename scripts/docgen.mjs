import { generateFiles } from 'fumadocs-typescript';
import * as path from 'node:path';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { stripIndents } from 'common-tags';
import { Project } from "ts-morph";

const outDir = './apps/website/content/api';
const inputDir = './packages';
const ignoredPackages = new Set(['tsconfig']);

// cleans jsdoc annotations/markdown/any special characters that are not allowed in yaml
const cleanDescription = (description) => {
    const annotationRegex = /@(\w+)/g;
    const markdownRegex = /`|\*|_|#|>|!|\[|\]|\(|\)|-|<|>|{|}|=|:|;|,|\.|'|"|\/|\\|\|/g;

    return description
        .replace(annotationRegex, '')
        .replace(markdownRegex, '')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

function card({ title, description, href }) {
    return `<Card title="${title}" description="${description}" href="${href}" />\n`;
}

async function generateModels() {
    await rm(outDir, { recursive: true }).catch(() => null);
    await mkdir(outDir, { recursive: true });
    const packages = (await readdir(inputDir)).filter((dir) => !ignoredPackages.has(dir));

    let root = stripIndents`---
    title: API Reference
    description: API Reference for Discord Player
    ---
    
    Select a module to view its documentation.`;

    root += '\n<Cards>\n';

    for (const pkg of packages) {
        const { name, version, description } = JSON.parse(await readFile(path.resolve(inputDir, pkg, 'package.json'), 'utf-8'));
        const normalizedName = name.replace('@discord-player/', '');
        const project = new Project({
            tsConfigFilePath: path.resolve(inputDir, pkg, 'tsconfig.json'),
            skipAddingFilesFromTsConfig: true,
        });

        project.addSourceFilesAtPaths(path.resolve(inputDir, pkg, 'src/**/*.ts'));

        project.resolveSourceFileDependencies();

        root += card({
            title: `${name}@${version}`,
            description,
            href: `/api/${normalizedName}`,
        });

        await mkdir(path.resolve(outDir, normalizedName), { recursive: true });

        const src = project.getSourceFiles();

        // const classes = src.flatMap(file => file.getClasses())
        //     .filter((value) => value.isExported());
        // const functions = src.flatMap(file => file.getFunctions())
        //     .filter((value) => value.isExported());
        const enums = src.flatMap(file => file.getEnums())
            .filter((value) => value.isExported());

        // const interfaces = src.flatMap(file => file.getInterfaces())
        //     .filter((value) => value.isExported());

        const props = {
            classes: [],
            functions: [],
            enums,
            interfaces: [],
        };

        const cardList = {
            classes: [],
            functions: [],
            enums: [],
            interfaces: [],
        };

        for (const [prop, data] of Object.entries(props)) {
            await mkdir(path.resolve(outDir, normalizedName, prop), { recursive: true });

            for (const item of data) {
                const namedItemPath = `${path.resolve(inputDir, pkg, 'src', item.getSourceFile().getFilePath()).replace(/\\/g, '/')}#${item.getName()}`;
                const content = stripIndents`---
                title: ${item.getName()}
                description: ${cleanDescription(item.getJsDocs().map((doc) => doc.getCommentText()).join(' ') || item.getName())}
                ---

                ${prop !== 'enum' && item.getJsDocs().map((doc) => doc.getInnerText()).join(' ')}
                
                ---type-table---
                ${namedItemPath}
                ---end---`;

                await writeFile(path.resolve(outDir, normalizedName, prop, `${item.getName()}.model.mdx`), content);

                cardList[prop].push(card({
                    title: item.getName(),
                    description: (item.getJsDocs().map((doc) => doc.getCommentText()).join(' ') || item.getName()),
                    href: `/api/${normalizedName}/${prop}/${item.getName()}`,
                }));
            }
        }

        const cards = Object.entries(cardList).flatMap(([key, value]) => `\n# ${key[0].toUpperCase() + key.slice(1)}\n\n<Cards>\n${value.join('\n')}\n</Cards>`);

        const content = stripIndents`---
        title: ${normalizedName}
        description: ${description}
        ---
        ${cards.join('\n')}
        `;

        await writeFile(path.resolve(outDir, normalizedName, 'index.model.mdx'), content);


    }

    root += '\n</Cards>';

    await writeFile(path.resolve(outDir, 'index.mdx'), root);
}

await generateModels();

await generateFiles({
    input: ['./apps/website/content/api/**/*.model.mdx'],
    output: (file) => {
        return path.resolve(
            path.dirname(file),
            `${path.basename(file).split('.')[0]}.mdx`,
        );
    },
    options: {
        config: {
            tsconfigPath: './packages/tsconfig/base.json',
        }
    }
});