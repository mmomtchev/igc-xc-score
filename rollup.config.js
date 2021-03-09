import resolve from '@rollup/plugin-node-resolve';
import builtins from 'builtin-modules';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import executable from 'rollup-plugin-executable';

export default [
    {
        input: 'src/cli.js',
        output: {
            file: 'dist/igc-xc-score.cjs',
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
        input: 'index.js',
        output: {
            file: 'dist/index.cjs',
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
                    'node_modules/**',
                ],
            }),
            json(),
            terser({
                mangle: false
            })
        ]
    }
];
