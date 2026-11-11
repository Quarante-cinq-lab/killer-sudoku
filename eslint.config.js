import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    // Règles des « hooks » React (useState, useEffect…).
    files: ['app/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // Le moteur ne dépend jamais de l'interface ni de Node.
    files: ['engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../app/*', '../scripts/*', 'react', 'react-dom'],
              message: "engine/ ne doit pas dépendre de l'interface.",
            },
            {
              group: ['node:*', 'fs', 'path'],
              message: 'engine/ doit rester utilisable dans le navigateur.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
