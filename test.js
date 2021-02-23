const fs = require('fs');
const path = require('path');
const WorkerThreads = require('worker_threads');
const IGCParser = require('igc-parser');
const solver = require('./solver');

const defaultConfig = {
    quiet: true,
    trim: true,
    env: { fs, WorkerThreads }
};

const tests = {
    FFVL: [
        { file: 'bigflat.igc', score: 224.09 },
    ]
};

(async () => {
    for (let rules of Object.keys(tests))
        for (let test of tests[rules]) {
            const flight = IGCParser.parse(fs.readFileSync(path.join('test', test.file), 'utf8'), { lenient: true });
            (await solver(flight, rules, defaultConfig).next()).value;
        }
})();