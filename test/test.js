'use strict';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import IGCParser from 'igc-parser';
import { solver, scoringRules } from '../index.js';
import * as util from '../src/util.js';
import { Point } from '../src/foundation.js';

const defaultConfig = {
    quiet: true,
    trim: true
};

const tests = {
    FFVL: [
        { file: 'bigflat.igc', score: 224.1 },
        { file: 'd3p.igc', score: 60.77 },
        { file: 'fai.igc', score: 228.69 },
        { file: 'fai.igc', score: 228.69, config: { hp: true } },
        { file: 'line.igc', score: 53.35, md5: 'c89684d7932480d5a9e9a0c9cd2b0b78' },
        { file: 'tri.igc', score: 17.52, md5: '9d4b9ccb6bec993a2e88ba67c496ec1b' },
        { file: 'record_de_france.igc', score: 422.02 },
        { file: 'record_de_france.igc', score: 421.99, config: { hp: true } },
        { file: 'zigzag.igc', score: 90.64 },
        { file: 'flat-ffvl-26.37.igc', score: 26.4 },
        { file: 'curvature-of-earth-triangle.igc', score: 90.72 },
        { file: 'vincentys.igc', score: 174.34 },
        { file: 'discontinuity.igc', score: 53.01 },
        { file: 'hiking-up.igc', score: 40.54 },
        { file: 'hiking-up-2.igc', score: 125.95 },
        { file: 'lunch-break.igc', score: 73.93 },
        { file: 'dup-fixes.igc', score: 89.11 },
        { file: 'd3p-anti-cache.igc', score: 58.53 },
        { file: 'marcourt.igc', score: 1.56, config: { trim: false } }
    ],
    XContest: [
        { file: 'flat-xcontest-106.82.igc', score: 107.13 },
        { file: 'trifai-xcontest-362.70.igc', score: 363.44 },
        { file: 'trifai-xcontest-362.70.igc', score: 363.44, config: { hp: true } },
        { file: 'freeflight-xcontest-66.46.igc', score: 66.5 },
        { file: 'flat-xcontest-100.59.igc', score: 100.77 },
        { file: 'flat-xcontest-8.01.igc', score: 8.02 },
        { file: 'trifai-xcontest-189.65.igc', score: 189.97 },
        { file: 'trifai-xcontest-189.65.igc', score: 189.95, config: { hp: true } },
        { file: 'trifai-xcontest-452.21.igc', score: 453.06 },
        { file: 'trifai-xcontest-452.21.igc', score: 453.04, config: { hp: true } },
        { file: 'trifai-xcontest-307.57.igc', score: 308.27 },
        { file: 'freeflight-xcontest-465.33.igc', score: 465.59 },
        { file: 'opentri-xcontest-428.31.igc', score: 428.6 }
    ],
    'FAI-OAR': [
        { file: 'trifai-xcontest-307.57.igc', score: 149.8 },
        { file: 'out-and-return-record.igc', score: 302.6 }
    ],
    'FAI': [
        { file: 'trifai-xcontest-189.65.igc', score: 130.13 },
        { file: 'trifai-xcontest-307.57.igc', score: 263.76 },
        { file: 'trifai-xcontest-452.21.igc', score: 290.63 },
        { file: 'record_de_france.igc', score: 421.08 },
        { file: 'fai.igc', score: 228.16 }
    ],
    XCLeague: [
        { file: 'trifai-xcontest-307.57.igc', score: 427 },
        { file: 'out-and-return-record.igc', score: 605.2 },
        { file: 'SwansonlowD-2022-07-16.igc', score: 249.6 },
        { file: 'ChuS-2022-08-13.igc', score: 90 },
        { file: 'AshleyS-2022-07-16.igc', score: 130.6 },
        { file: 'MurphyJ-2022-03-26.igc', score: 24.6 }
    ]
};

for (let rules of Object.keys(tests))
    for (let test of tests[rules]) {
        const flight = IGCParser.parse(fs.readFileSync(path.join('test', test.file), 'utf8'), { lenient: true });
        const ts = Date.now();
        const best = solver(flight, scoringRules[rules], { ...defaultConfig, ...test.config }).next().value;
        if (best.score == test.score)
            console.log(rules, test.file,
                (test.config || {}).hp ? 'HP' : 'Fast', best.score,
                (Date.now() - ts) + 'ms',
                util.consoleColors.fg.green + String.fromCodePoint(0x2713) + util.consoleColors.reset);
        else {
            console.error(rules, test.file, test.score, best.score,
                util.consoleColors.fg.red + 'x' + util.consoleColors.reset);
            if (process.argv[2] !== 'force')
                process.exit(1);
        }
        const geojson = best.geojson();
        if (test.md5) {
            const hash = crypto.createHash('md5');
            delete geojson.properties.processedTime;
            hash.update(JSON.stringify(geojson));
            const digest = hash.digest('hex');
            if (digest !== test.md5) {
                console.error(rules, test.file, digest, test.md5);
                if (process.argv[2] !== 'force')
                    process.exit(1);
            }
        }
        for (let f of geojson.features) {
            if (f.properties.id.match(/^seg/)) {
                const p0 = new Point(f.geometry.coordinates[0][0], f.geometry.coordinates[0][1]);
                const p1 = new Point(f.geometry.coordinates[1][0], f.geometry.coordinates[1][1]);
                const dReported = geojson.properties.d;
                const dComputed = p0.distanceEarth(p1);
                if (Math.abs(dReported - dComputed) > 0.001) {
                    console.error('incorrect distance reported', p0, p1, dReported.toFixed(4), dComputed.toFixed(4));
                    if (process.argv[2] !== 'force')
                        process.exit(1);
                }
            }
        }
    }
