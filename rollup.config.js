import resolve from '@rollup/plugin-node-resolve';
import builtins from 'builtin-modules';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import executable from 'rollup-plugin-executable';
const version = require('./package.json').version;

export default [
    {
        input: 'src/cli.js',
        output: {
            file: 'dist/igc-xc-score.cjs',
            format: 'cjs',
            compact: true,
            banner: '#!/usr/bin/env node\n',
            intro: `const _version = '${version}'`
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
            exports: 'named',
            intro: `const _version = '${version}'`
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
