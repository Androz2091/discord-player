/* eslint-disable */
const { runGenerator } = require('@discordjs/ts-docgen');

runGenerator({
    existingOutput: `${__dirname}/../docs/typedoc.json`,
    custom: `${__dirname}/../docs/config.yml`,
    output: `${__dirname}/../docs/docs.json`
});
