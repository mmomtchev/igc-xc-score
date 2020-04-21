import resolve from '@rollup/plugin-node-resolve';
import builtins from 'builtin-modules';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';

export default [
	{
		input: 'index.js',
		output: {
			file: 'igc-xc-score.min.js',
			format: 'cjs',
			compact: true
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
			terser()
		]
	}
];
