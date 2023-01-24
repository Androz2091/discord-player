/* eslint-disable */

const nextra = require('nextra');
const withNextra = (nextra.default || nextra)({
    theme: 'nextra-theme-docs',
    themeConfig: './theme.config.jsx',
});

module.exports = withNextra({
    typescript: {
        ignoreBuildErrors: true
    }
});