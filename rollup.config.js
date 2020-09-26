import resolve from '@rollup/plugin-node-resolve';
import builtins from 'builtin-modules';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import executable from 'rollup-plugin-executable';

export default [
	{
		input: 'index.js',
		output: {
			file: 'igc-xc-score.js',
			format: 'cjs',
			compact: true,
			banner: '#!/usr/bin/env node\n'
		},
		external: builtins,
		plugins: [
			resolve({
				preferBuiltins: true
			}),
			commonjs({
				include: [
					'*.js',
					'*.json',
					'node_modules/**',
				],
			}),
			json(),
			terser({
				mangle: false
			}),
			executable()
		]
	},
	{
		input: 'main.js',
		output: {
			file: 'index.cjs.js',
			format: 'cjs',
			compact: true,
			exports: 'named'
		},
		external: builtins,
		plugins: [
			resolve({
				preferBuiltins: true
			}),
			commonjs({
				include: [
					'*.js',
					'*.json',
					'node_modules/**',
				],
			}),
			json(),
			terser({
				mangle: false
			})
		]
	},
	{
		input: 'module.js',
		output: {
			file: 'index.es.js',
			format: 'cjs',
			compact: false,
		},
		external: builtins,
		plugins: [
			resolve({
				preferBuiltins: true
			}),
			commonjs({
				include: [
					'*.js',
					'*.json',
					'node_modules/**',
				],
			})
		]
	}
];
