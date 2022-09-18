'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const IGCParser = require('igc-parser');
const { solver, scoringRules } = require('..');

const defaultConfig = {
    quiet: true,
    trim: true
};

const tests = {
    FFVL: [
        { file: 'tri.igc', score: 17.51, md5: '87f88b9084fe23ed60a74b939b7cf9cc' },
        { file: 'tri.igc', score: 17.51, config: { hp: true } }
    ]
};

for (let rules of Object.keys(tests))
    for (let test of tests[rules]) {
        const flight = IGCParser.parse(fs.readFileSync(path.join('test', test.file), 'utf8'), { lenient: true });
        const best = solver(flight, scoringRules[rules], { ...defaultConfig, ...test.config }).next().value;
        if (best.score != test.score) {
            console.error(rules, test.file, test.score, best.score);
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
    }
