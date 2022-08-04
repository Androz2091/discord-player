/* eslint-disable */
const { runGenerator } = require("@discordjs/ts-docgen");

runGenerator({
    existingOutput: "docs/typedoc.json",
    custom: "docs/config.yml",
    output: "docs/docs.json"
});