import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
	{
		ignores: ['node_modules/**', 'dist/**', '.wrangler/**', 'drizzle/**', 'coverage/**'],
	},
	js.configs.recommended,
	{
		files: ['**/*.ts', '**/*.tsx'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				project: './tsconfig.json',
			},
		},
		plugins: {
			'@typescript-eslint': tseslint,
		},
		rules: {
			...tseslint.configs.recommended.rules,
			// TypeScript specific rules
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-non-null-assertion': 'warn',
			'@typescript-eslint/prefer-optional-chain': 'error',
			'@typescript-eslint/prefer-nullish-coalescing': 'error',
			'@typescript-eslint/no-unnecessary-type-assertion': 'error',
			'@typescript-eslint/no-floating-promises': 'error',

			// General JavaScript/TypeScript rules
			'prefer-const': 'error',
			'no-var': 'error',
			'no-console': 'off', // Allow console in workers
			eqeqeq: ['error', 'always'],
			curly: ['error', 'all'],
			'brace-style': ['error', '1tbs'],
			'comma-dangle': ['error', 'es5'],
			quotes: ['error', 'double'],
			semi: ['error', 'always'],
			'object-shorthand': 'error',
			'prefer-arrow-callback': 'error',
			'prefer-template': 'error',
		},
	},
	{
		files: ['**/*.test.ts', '**/*.spec.ts', 'test/**/*.ts'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/no-floating-promises': 'off',
		},
	},
];
