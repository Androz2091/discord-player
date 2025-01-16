/* eslint-disable */

import { createDocumentation } from 'micro-docgen';
import { writeFile } from 'node:fs/promises';

const normalizeName = (name: string) => name.replace('@discord-player/', '');

const shouldGenerateJSON = process.argv.includes('--json');

async function main() {
  const docs = await createDocumentation({
    input: ['.'],
    markdown: !shouldGenerateJSON,
    clean: !shouldGenerateJSON,
    typeLinkerBasePath: '/api',
    extension: 'mdx',
    includeMarkdownHeaders: true,
    omitTypeLinkerExtension: true,
    output: './apps/website/content/api',
    noEmit: shouldGenerateJSON,
  });

  const modules = Object.values(docs.modules);

  console.log(
    `Generated docs for ${modules.length} modules in ${docs.metadata.generationMs}`,
  );

  if (shouldGenerateJSON) {
    await writeFile('./apps/website/lib/data/docs.json', JSON.stringify(docs));
    process.exit(0);
  }

  const heading = (name: string, description: string) =>
    `---\ntitle: ${normalizeName(name)}\ndescription: ${
      description || 'No description available.'
    }\n---\n\n`;
  const cards = [
    heading('Discord Player', 'Documentation for Discord Player monorepo'),
    '# Packages',
    '<Cards>',
  ];

  for (const mod of modules) {
    cards.push(
      `<Card title="${
        mod.name
      }" description="${`Documentation for ${mod.name} package`}" href="/api/${normalizeName(
        mod.name,
      )}" />`,
    );

    const classes = Object.values(mod.classes).map((cls) => {
      return `<Card title="${cls.data.name}" description="${
        cls.data.description || `Docs for class ${cls.data.name}`
      }" href="/api/${normalizeName(mod.name)}/classes/${cls.data.name}" />`;
    });

    const types = Object.values(mod.types).map((int) => {
      return `<Card title="${int.data.name}" description="${
        int.data.description || `Docs for type ${int.data.name}`
      }" href="/api/${normalizeName(mod.name)}/types/${int.data.name}" />`;
    });

    const functions = Object.values(mod.functions).map((func) => {
      return `<Card title="${func.data.name}" description="${
        func.data.description || `Docs for function ${func.data.name}`
      }" href="/api/${normalizeName(mod.name)}/functions/${func.data.name}" />`;
    });

    const variables = Object.values(mod.variables).map((varr) => {
      return `<Card title="${varr.data.name}" description="${
        varr.data.description || `Docs for variable ${varr.data.name}`
      }" href="/api/${normalizeName(mod.name)}/variables/${varr.data.name}" />`;
    });

    const enums = Object.values(mod.enum).map((en) => {
      return `<Card title="${en.data.name}" description="${
        en.data.description || `Docs for enum ${en.data.name}`
      }" href="/api/${normalizeName(mod.name)}/enums/${en.data.name}" />`;
    });

    const classesContent = classes.length
      ? `# Classes\n\n<Cards>${classes.join('\n\n')}</Cards>`
      : '';

    const interfacesContent = types.length
      ? `# Types\n\n<Cards>${types.join('\n\n')}</Cards>`
      : '';

    const functionsContent = functions.length
      ? `# Functions\n\n<Cards>${functions.join('\n\n')}</Cards>`
      : '';

    const variablesContent = variables.length
      ? `# Variables\n\n<Cards>${variables.join('\n\n')}</Cards>`
      : '';

    const enumsContent = enums.length
      ? `# Enums\n\n<Cards>${enums.join('\n\n')}</Cards>`
      : '';

    const content = [
      heading(
        mod.name,
        'Beginner friendly command & event handler for Discord.js',
      ),
      '\n',
      classesContent,
      '\n',
      interfacesContent,
      '\n',
      functionsContent,
      '\n',
      variablesContent,
      '\n',
      enumsContent,
    ].join('\n');

    // classes index
    if (classesContent) {
      await writeFile(
        `./apps/website/content/api/${normalizeName(
          mod.name,
        )}/classes/index.mdx`,
        heading('Classes', `Classes provided by ${normalizeName(mod.name)}`) +
          classesContent,
      ).catch(Object);
    }

    // interfaces index
    if (interfacesContent) {
      await writeFile(
        `./apps/website/content/api/${normalizeName(mod.name)}/types/index.mdx`,
        heading('Types', `Types provided by ${normalizeName(mod.name)}`) +
          interfacesContent,
      ).catch(Object);
    }

    // functions index
    if (functionsContent) {
      await writeFile(
        `./apps/website/content/api/${normalizeName(
          mod.name,
        )}/functions/index.mdx`,
        heading(
          'Functions',
          `Functions provided by ${normalizeName(mod.name)}`,
        ) + functionsContent,
      ).catch(Object);
    }

    // variables index
    if (variablesContent) {
      await writeFile(
        `./apps/website/content/api/${normalizeName(
          mod.name,
        )}/variables/index.mdx`,
        heading(
          'Variables',
          `Variables provided by ${normalizeName(mod.name)}`,
        ) + variablesContent,
      ).catch(Object);
    }

    // enums index
    if (enumsContent) {
      await writeFile(
        `./apps/website/content/api/${normalizeName(mod.name)}/enums/index.mdx`,
        heading('Enums', `Enums provided by ${normalizeName(mod.name)}`) +
          enumsContent,
      ).catch(Object);
    }

    await writeFile(
      `./apps/website/content/api/${normalizeName(mod.name)}/index.mdx`,
      content,
    );
  }

  cards.push('</Cards>');

  await writeFile('./apps/website/content/api/index.mdx', cards.join('\n\n'));
}

main();
