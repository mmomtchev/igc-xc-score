const fs = require('fs');
const path = require('path');
const IGCParser = require('./igc-parser');
const solver = require('./solver');
const scoringRules = require('./scoring-rules.config');

const tests = {
    FFVL: [
        { file: 'bigflat.igc', score: 225.20 },
        { file: 'd3p.igc', score: 60.77 },
        { file: 'fai.igc', score: 228.71 },
        { file: 'line.igc', score: 53.34 },
        { file: 'tri.igc', score: 17.51 }
    ],
    XContest: [
        { file: 'flat-xcontest-106.82.igc', score: 107.12 },
        { file: 'trifai-xcontest-362.70.igc', score: 363.43 },
        { file: 'freeflight-xcontest-66.46.igc', score: 66.47 },
        { file: 'flat-xcontest-100.59.igc', score: 102.27 },
        { file: 'flat-xcontest-8.01.igc', score: 8.07 },
        { file: 'trifai-xcontest-189.65.igc', score: 191.84 },
        { file: 'trifai-xcontest-452.21.igc', score: 455.38 },
        { file: 'trifai-xcontest-307.57.igc', score: 308.33 }
        //{ file: 'freeflight-xcontest-465.33.igc', score: 465.55 }, // this one is still very slow
    ]
};

for (let rules of Object.keys(tests))
    for (let test of tests[rules]) {
        const flight = IGCParser.parse(fs.readFileSync(path.join('test', test.file), 'utf8'));
        const best = solver(flight, scoringRules[rules], { quiet: true }).next().value;
        if (best.score == test.score)
            console.log(rules, test.file, String.fromCodePoint(0x2713));
        else {
            console.error(rules, test.file, test.score, best.score);
            process.exit(1);
        }
    }
