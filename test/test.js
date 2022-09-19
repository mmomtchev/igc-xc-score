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
        { file: 'bigflat.igc', score: 224.09 },
        { file: 'd3p.igc', score: 60.77 },
        { file: 'fai.igc', score: 228.71 },
        { file: 'fai.igc', score: 228.72, config: { hp: true } },
        { file: 'line.igc', score: 53.34, md5: 'b719ccb5c9a708c740618d4cb9acb7e2' },
        { file: 'tri.igc', score: 17.51, md5: '0fb3d6bccc3a0951fe1fd8b88b6766eb' },
        { file: 'record_de_france.igc', score: 422.02 },
        { file: 'record_de_france.igc', score: 421.99, config: { hp: true } },
        { file: 'zigzag.igc', score: 90.64 },
        { file: 'flat-ffvl-26.37.igc', score: 26.4 },
        { file: 'curvature-of-earth-triangle.igc', score: 90.71 },
        { file: 'vincentys.igc', score: 174.35 },
        { file: 'discontinuity.igc', score: 53.01 },
        { file: 'hiking-up.igc', score: 40.53 },
        { file: 'hiking-up-2.igc', score: 125.94 },
        { file: 'lunch-break.igc', score: 73.92 },
        { file: 'dup-fixes.igc', score: 89.1 },
        { file: 'd3p-anti-cache.igc', score: 58.53 },
        { file: 'marcourt.igc', score: 1.57, config: { trim: false } }
    ],
    XContest: [
        { file: 'flat-xcontest-106.82.igc', score: 107.12 },
        { file: 'trifai-xcontest-362.70.igc', score: 363.43 },
        { file: 'trifai-xcontest-362.70.igc', score: 363.42, config: { hp: true } },
        { file: 'freeflight-xcontest-66.46.igc', score: 66.5 },
        { file: 'flat-xcontest-100.59.igc', score: 100.76 },
        { file: 'flat-xcontest-8.01.igc', score: 8.01 },
        { file: 'trifai-xcontest-189.65.igc', score: 189.96 },
        { file: 'trifai-xcontest-189.65.igc', score: 189.96, config: { hp: true } },
        { file: 'trifai-xcontest-452.21.igc', score: 453.04 },
        { file: 'trifai-xcontest-452.21.igc', score: 453.02, config: { hp: true } },
        { file: 'trifai-xcontest-307.57.igc', score: 308.26 },
        { file: 'freeflight-xcontest-465.33.igc', score: 465.58 },
        { file: 'opentri-xcontest-428.31.igc', score: 428.59 }
    ],
    'FAI-OAR': [
        { file: 'trifai-xcontest-307.57.igc', score: 149.77 },
        { file: 'out-and-return-record.igc', score: 302.56 }
    ],
    'FAI': [
        { file: 'trifai-xcontest-189.65.igc', score: 130.78 },
        { file: 'trifai-xcontest-307.57.igc', score: 264.44 },
        { file: 'trifai-xcontest-452.21.igc', score: 291.33 },
        { file: 'fai.igc', score: 228.71 }
    ],
    XCLeague: [
        { file: 'trifai-xcontest-307.57.igc', score: 426.97 },
        { file: 'out-and-return-record.igc', score: 605.12 },
        { file: 'SwansonlowD-2022-07-16.igc', score: 249.59 },
        { file: 'ChuS-2022-08-13.igc', score: 89.97 },
        { file: 'AshleyS-2022-07-16.igc', score: 130.48 },
        { file: 'MurphyJ-2022-03-26.igc', score: 24.55 }
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
