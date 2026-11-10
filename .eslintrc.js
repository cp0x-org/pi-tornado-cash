module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2020: true
  },
  parserOptions: {
    parser: '@babel/eslint-parser',
    requireConfigFile: false,
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  extends: ['@nuxtjs', 'plugin:nuxt/recommended', 'plugin:prettier/recommended'],
  plugins: ['prettier'],
  // add your custom rules here
  rules: {
    'prettier/prettier': ['error', { printWidth: 110 }],
    'no-async-promise-executor': 'off',
    'vue/comment-directive': 'off',
    'no-console': 'off',
    // Rules introduced by newer @nuxtjs/eslint-config / eslint-plugin-vue that the
    // existing codebase does not follow. Kept as warnings/off to avoid a mass refactor.
    'array-callback-return': 'warn',
    'no-useless-catch': 'warn',
    'nuxt/no-env-in-hooks': 'warn',
    'vue/multi-word-component-names': 'off',
    'vue/no-reserved-component-names': 'off',
    'vue/v-slot-style': 'off',
    'vue/order-in-components': 'off',
    'vue/this-in-template': 'off'
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/__tests__/**/*.js'],
      env: { jest: true }
    },
    {
      files: ['store/snark.js'],
      rules: { camelcase: ['error', { allow: ['__webpack_public_path__'] }] }
    }
  ]
}
