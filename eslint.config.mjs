import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'drizzle/**/*', '.gmp_cache/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
