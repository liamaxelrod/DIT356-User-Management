module.exports = {
    env: {
        node: true,
    },
    extends: 'eslint:recommended',
    parserOptions: {
        ecmaVersion: 8,
    },
    rules: {
        'no-console': 'off',
        'linebreak-style': ['error', 'unix'],
        quotes: ['error', 'single'],
        semi: ['error', 'always'],
        'no-undef': 'off',
    },
};
