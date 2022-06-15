/* eslint-disable */
const { runGenerator } = require("@discordjs/ts-docgen");
const fs = require("node:fs");

runGenerator({
    existingOutput: "docs/typedoc.json",
    custom: "docs/config.yml",
    output: "docs/docs.json"
});

fs.unlinkSync(`${__dirname}/../docs/typedoc.json`);