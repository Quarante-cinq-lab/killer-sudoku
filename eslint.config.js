import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

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
