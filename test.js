const fs = require('fs');
const path = require('path');
const IGCParser = require('./igc-parser');
const solver = require('./solver');
const util = require('./util');
const scoringRules = require('./scoring-rules.config');

const defaultConfig = {
    quiet: true,
    detectLanding: true,
    detectLaunch: true
};

const tests = {
    FFVL: [
        { file: 'bigflat.igc', score: 225.21 },
        { file: 'd3p.igc', score: 60.77 },
        { file: 'fai.igc', score: 228.71 },
        { file: 'fai.igc', score: 228.72, config: { hp: true } },
        { file: 'line.igc', score: 53.34 },
        { file: 'tri.igc', score: 17.51 },
        { file: 'record_de_france.igc', score: 422.02 },
        { file: 'record_de_france.igc', score: 421.99, config: { hp: true } },
        { file: 'zigzag.igc', score: 90.64 },
        { file: 'flat-ffvl-26.37.igc', score: 26.4 },
        { file: 'curvature-of-earth-triangle.igc', score: 90.71 },
        { file: 'vincentys.igc', score: 174.35 },
        { file: 'discontinuity.igc', score: 53.01 }
    ],
    XContest: [
        { file: 'flat-xcontest-106.82.igc', score: 107.12 },
        { file: 'trifai-xcontest-362.70.igc', score: 363.43 },
        { file: 'trifai-xcontest-362.70.igc', score: 363.42, config: { hp: true } },
        { file: 'freeflight-xcontest-66.46.igc', score: 66.5 },
        { file: 'flat-xcontest-100.59.igc', score: 102.27 },
        { file: 'flat-xcontest-8.01.igc', score: 8.08 },
        { file: 'trifai-xcontest-189.65.igc', score: 191.89 },
        { file: 'trifai-xcontest-189.65.igc', score: 191.88, config: { hp: true } },
        { file: 'trifai-xcontest-452.21.igc', score: 455.38 },
        { file: 'trifai-xcontest-452.21.igc', score: 455.37, config: { hp: true } },
        { file: 'trifai-xcontest-307.57.igc', score: 308.33 },
        { file: 'freeflight-xcontest-465.33.igc', score: 465.58 }
    ]
};

for (let rules of Object.keys(tests))
    for (let test of tests[rules]) {
        const flight = IGCParser.parse(fs.readFileSync(path.join('test', test.file), 'utf8'));
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
    }
