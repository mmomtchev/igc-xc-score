'use strict';
const webpack = require('webpack');
const path = require('path');
const exec = require('child_process');

const build_pkg = require('./package.json');
const build_git = exec.execSync('git rev-parse --short HEAD').toString();
const build_date = exec.execSync('date -I').toString();

module.exports = {
    mode: 'none',
    context: __dirname,
    entry: {
        index: './www/index.js'
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname , 'dist', 'www'),
        publicPath: '/xc-score/'
    },
    resolve: {
        modules: ['node_modules'],
        alias: {
            jquery: 'jquery/dist/jquery.min.js',
            handlebars: 'handlebars/dist/handlebars.min.js',
            jquery_typeahead: 'jquery-typeahead/dist/jquery.typeahead.min.js'
        }
    },
    devtool: 'inline-source-map',
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
        })
    ],
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }
        ]
    }
};