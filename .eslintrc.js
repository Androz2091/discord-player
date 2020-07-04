module.exports = {
    env: {
        commonjs: true,
        es6: true,
        node: true
    },
    extends: [
        'standard'
    ],
    globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly'
    },
    parserOptions: {
        ecmaVersion: 11
    },
    rules: {
        indent: ['error', 4],
        'no-async-promise-executor': 'off',
        'no-unused-vars': 'off'
    }
}
