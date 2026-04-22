import js from '@eslint/js'
import playwright from 'eslint-plugin-playwright'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['node_modules', 'playwright-report', 'test-results'] },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2022 },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Playwright fixtures require an empty object pattern `({}, use) => …`
    // as the first argument when the fixture needs no dependencies — it
    // literally errors out with `_` or a named identifier.
    files: ['src/fixtures/**/*.ts'],
    rules: {
      'no-empty-pattern': 'off',
    },
  },
  {
    // Playwright plugin rules only for *.spec.ts files
    files: ['**/*.spec.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // Our journey-pattern spec files intentionally have no `expect()` calls
      // in the body — all assertions live inside journey steps (verify*,
      // create*, advance*, etc.). The plugin can't see through test.step().
      'playwright/expect-expect': 'off',
      // Plugin warns about "prefer web-first assertions" on API (non-page)
      // calls, which are our default mode.
      'playwright/prefer-web-first-assertions': 'off',
    },
  },
)
