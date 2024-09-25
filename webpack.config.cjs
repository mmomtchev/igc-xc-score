'use strict';
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const path = require('path');
const exec = require('child_process');

const build_pkg = require('./package.json');
const build_git = exec.execSync('git rev-parse --short HEAD').toString();
const now = new Date;
const build_date = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

module.exports = (env, argv) => ({
    mode: 'none',
    context: __dirname,
    entry: {
        index: path.resolve(__dirname, 'www', 'index.js')
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist', 'www'),
        publicPath: '/xc-score/'
    },
    resolve: {
        modules: ['node_modules'],
        alias: {
            'igc-xc-score': path.resolve(__dirname, 'index.js'),
            jquery: 'jquery/dist/jquery.min.js'
        }
    },
    devtool: argv.mode == 'development' ? 'eval-source-map' : undefined,
    plugins: [
        new webpack.ProvidePlugin({
            $: 'jquery',
            jQuery: 'jquery',
            'window.jQuery': 'jquery',
        }),
        new webpack.DefinePlugin({
            __BUILD_GIT__: JSON.stringify(build_git),
            __BUILD_PKG__: JSON.stringify(build_pkg),
            __BUILD_DATE__: JSON.stringify(build_date),
            __DEBUG__: JSON.stringify(argv.mode == 'development')
        }),
        new CopyPlugin({
            patterns: [
                { from: 'www/index.html', to: 'index.html' },
                { from: 'www/pacman.svg', to: 'pacman.svg' }
            ]
        })
    ],
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }
        ]
    },
    optimization: {
        usedExports: true
    },
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist', 'www'),
        },
        compress: true,
        port: 9000
    }
});
