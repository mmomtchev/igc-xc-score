const fs = require('fs');
const path = require('path');
const IGCParser = require('./igc-parser');
const scoring = require('./scoring');
const solver = require('./solver');

const testsFFVL = [
    { file: 'bigflat.igc', score: 225.20 },
    { file: 'd3p.igc', score: 60.77 },
    { file: 'fai.igc', score: 228.71 },
    { file: 'line.igc', score: 53.34 },
    { file: 'tri.igc', score: 17.51 }
];

for (let test of testsFFVL) {
    const flight = IGCParser.parse(fs.readFileSync(path.join('test', test.file), 'utf8'));
    const best = solver(flight, scoring.scoringFFVL, { quiet: true });
    if (best.score == test.score)
        console.log(test.file, String.fromCodePoint(0x2713));
    else {
        console.error(test.file, test.score, best.score);
        process.exit(1);
    }
}
